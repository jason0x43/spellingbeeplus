use axum::{
    extract::{
        ws::{Message, WebSocket},
        ConnectInfo, State, WebSocketUpgrade,
    },
    http::{header, StatusCode, Uri},
    response::{IntoResponse, Redirect, Response},
};
use futures::{stream::StreamExt, SinkExt};
use rust_embed::RustEmbed;
use serde_json::json;
use std::{
    net::SocketAddr,
    ops::ControlFlow,
    sync::{Arc, Mutex},
};
use tokio::sync::broadcast::Sender;
use tracing::{debug, info, warn};

use crate::{error::AppError, message::Msg, state::AppState};

#[derive(RustEmbed)]
#[folder = "public/"]
struct Public;

struct Context {
    _state: Arc<AppState>,
    name: Mutex<String>,
    tx: Sender<Msg>,
}

pub(crate) async fn hello() -> Result<String, AppError> {
    Ok("Hello, World!".to_string())
}

pub(crate) async fn root() -> Result<Redirect, AppError> {
    Ok(Redirect::to("/index.html"))
}

pub(crate) async fn ws(
    ws: WebSocketUpgrade,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_connection(socket, addr, state))
}

/// Handle a new WebSocket connection
async fn handle_connection(
    socket: WebSocket,
    addr: SocketAddr,
    state: Arc<AppState>,
) {
    debug!("Connected client at {addr}");

    // Split the socket so we can send and receive at the same time
    let (mut sender, mut receiver) = socket.split();

    // Send the current server version to the client, which may cause the client
    // to reload
    if let Err(err) = sender
        .send(Message::Text(
            json!({ "version": state.version }).to_string(),
        ))
        .await
    {
        warn!("Error sending version: {err}");
    }

    let names = state.user_names.lock().unwrap().clone();
    debug!("Names: {names:?}");
    for name in names {
        let joined_msg = Msg::Joined(name.clone());
        if sender.send(Message::Text(joined_msg.into())).await.is_err() {
            warn!("Error sending joined message for {name}");
            return;
        }
        debug!("Sent join message for {name}");
    }

    // Create a variable to hold this client's name
    let mut name = String::new();

    // Wait for the client to send a name message, then update the name
    while let Some(Ok(message)) = receiver.next().await {
        if let Message::Text(text) = message {
            match serde_json::from_str::<Msg>(&text) {
                Ok(Msg::SetName(cmd)) => {
                    name = cmd.name;
                    break;
                }
                Ok(_) => {
                    warn!("Ignored command {text:?}");
                    let _ = sender.send(Message::Text(
                        Msg::Error(format!("User name must be set")).into(),
                    ));
                }
                Err(err) => {
                    warn!("Invalid command {text:?}: {err}");
                    let _ = sender.send(Message::Text(
                        Msg::Error(format!("Invalid command {text:?}: {err}"))
                            .into(),
                    ));
                }
            }
        }
    }

    // Update the state
    state.user_names.lock().unwrap().insert(name.clone());

    // Subscribe to the broadcast channel
    let mut rx = state.tx.subscribe();

    // Send a "joined" message to all broadcast subscribers
    let joined_msg = Msg::Joined(name.clone());
    let _ = state.tx.send(joined_msg);
    debug!("Sent joined message for {name}");

    // Create a context that can be shared with message handlers
    let tx = state.tx.clone();
    let context = Arc::new(Context {
        _state: state.clone(),
        name: name.clone().into(),
        tx,
    });

    // Forward broadcast messages to the client
    let local_ctx = context.clone();
    let mut local_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            let orig_msg = msg.clone();
            let result = match msg {
                Msg::Sync(sync_msg) => {
                    if sync_msg.to == local_ctx.name.lock().unwrap().clone() {
                        sender.send(Message::Text(orig_msg.into())).await
                    } else {
                        Ok(())
                    }
                },
                _ => sender.send(Message::Text(msg.into())).await
            };
            if result.is_err() {
                break;
            }
        }
    });

    // Handle incoming WebSocket messages
    let recv_ctx = context.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            info!("Received a message: {msg:?}");
            if handle_message(msg, &recv_ctx).await.is_break() {
                info!("Messages finished");
                return;
            }
        }
    });

    // If either listener task stops, kill the other task
    tokio::select! {
        _ = (&mut local_task) => recv_task.abort(),
        _ = (&mut recv_task) => local_task.abort(),
    }

    // Let subscribers know that this client has left
    let current_name = &context.name.lock().unwrap().clone();
    let left_msg = Msg::Left(current_name.into());
    let _ = state.tx.send(left_msg);
    debug!("Sent left message for {current_name}");

    // Remove this client's name from the user name list
    state.user_names.lock().unwrap().remove(current_name);
}

/// Handle an incoming WebSocket message
async fn handle_message(
    msg: Message,
    context: &Arc<Context>,
) -> ControlFlow<(), ()> {
    match msg {
        Message::Close(_) => {
            debug!("Received close message");
            ControlFlow::Break(())
        },
        Message::Text(msg) => {
            match serde_json::from_str::<Msg>(&msg) {
                Ok(msg) => {
                    handle_msg(msg, context).await;
                }
                Err(err) => {
                    warn!("Invalid command {msg:?}: {err}");
                }
            }
            ControlFlow::Continue(())
        }
        _ => {
            debug!("Ignoring message");
            ControlFlow::Continue(())
        }
    }
}

/// Handle a Command message
async fn handle_msg(
    msg: Msg,
    context: &Arc<Context>,
) -> ControlFlow<(), ()> {
    match msg {
        Msg::SetName(msg) => {
            debug!("Setting name to: {}", msg.name);
            let mut name = context.name.lock().unwrap();

            // Notify that the previous name has left
            let _ = context.tx.send(Msg::Left(name.clone()));

            // Notify that the new name has joined
            *name = msg.name.clone();
            let _ = context.tx.send(Msg::Joined(msg.name.clone()));

            ControlFlow::Continue(())
        }
        Msg::Sync(msg) => {
            debug!("Got sync request from {} to {}", msg.from, msg.to);
            let _ = context.tx.send(Msg::Sync(msg));
            ControlFlow::Continue(())
        }
        _ => {
            warn!("Not handling {msg:?}");
            ControlFlow::Continue(())
        }
    }
}

pub(crate) async fn public_files(uri: Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');
    if let Some(content) = Public::get(path) {
        let mime = mime_guess::from_path(path).first_or_octet_stream();
        add_cache_control(
            ([(header::CONTENT_TYPE, mime.as_ref())], content.data)
                .into_response(),
        )
    } else {
        (StatusCode::NOT_FOUND, "404").into_response()
    }
}

/// Add a cache control header to a response
fn add_cache_control(resp: Response) -> Response {
    let mut resp = resp;
    let headers = resp.headers_mut();
    headers.insert(header::CACHE_CONTROL, "max-age=31536000".parse().unwrap());
    resp
}
