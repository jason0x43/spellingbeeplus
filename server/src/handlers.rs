use axum::{
    extract::{
        ws::{Message, WebSocket},
        ConnectInfo, State, WebSocketUpgrade,
    },
    http::{header, StatusCode, Uri},
    response::{Html, IntoResponse, Redirect, Response},
    Json,
};
use futures::{stream::StreamExt, SinkExt};
use handlebars::Handlebars;
use rust_embed::RustEmbed;
use serde_json::json;
use std::{net::SocketAddr, ops::ControlFlow, str::from_utf8, sync::Arc};
use tokio::sync::broadcast::Sender;
use tracing::{debug, info, warn};
use uuid::Uuid;

use crate::{
    error::AppError,
    message::{Connect, ErrMsg, ErrMsgKind, Joined, Msg, MsgContent},
    types::{ApiKey, AppState, AuthToken, ExpiryTime, TokenResponse},
};

#[derive(RustEmbed)]
#[folder = "public/"]
struct Public;

struct Context {
    state: Arc<AppState>,
    id: Uuid,
    tx: Sender<Msg>,
}

pub(crate) async fn hello() -> Result<String, AppError> {
    Ok("Hello, World!".to_string())
}

pub(crate) async fn root() -> Result<Redirect, AppError> {
    Ok(Redirect::to("/index.html"))
}

pub(crate) async fn index(
    state: State<Arc<AppState>>,
) -> Result<Response, AppError> {
    let api_key = state.api_key.clone();
    let index_tmpl = get_file("index.html")?;
    let renderer = Handlebars::new();
    let index = renderer
        .render_template(&index_tmpl, &json!({ "API_KEY": api_key }))?;
    Ok(Html(index).into_response())
}

pub(crate) async fn token(
    state: State<Arc<AppState>>,
    key: ApiKey,
) -> impl IntoResponse {
    if key != state.api_key {
        return AppError::Unauthorized().into_response();
    }

    let new_token = AuthToken::new();
    state
        .auth_tokens
        .lock()
        .unwrap()
        .insert(new_token.clone(), ExpiryTime::new());
    Json(TokenResponse { token: new_token }).into_response()
}

pub(crate) async fn ws(
    ws: WebSocketUpgrade,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<Arc<AppState>>,
    token: AuthToken,
) -> impl IntoResponse {
    let tokens = state.auth_tokens.lock().unwrap().clone();
    let expiry = tokens.get(&token);
    if let Some(expiry) = expiry {
        if expiry.is_expired() {
            return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
        }
    } else {
        return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
    }

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

    // Create a variable to hold this client's name
    let mut name = String::new();
    // Create a new ID for this client
    let id = Uuid::new_v4();

    // Send the client a unique ID for it to use, along with the current server
    // version, which may cause the client to reload
    let result = sender
        .send(
            Msg {
                to: None,
                from: None,
                content: MsgContent::Connect(Connect {
                    version: state.version,
                    id,
                }),
            }
            .into(),
        )
        .await;
    if let Err(err) = result {
        warn!("Error sending connect message: {err}");
    }

    // Tell the new client about any existing clients
    let names = state.user_names.lock().unwrap().clone();
    debug!("Names: {names:?}");
    for (id, name) in names {
        if sender
            .send(
                Msg {
                    from: None,
                    to: None,
                    content: MsgContent::Joined(Joined {
                        id,
                        name: name.clone(),
                    }),
                }
                .into(),
            )
            .await
            .is_err()
        {
            warn!("Error sending joined message for {name}");
            return;
        }
        debug!("Sent join message for {name}");
    }

    // Wait for the client to send a name message, then update the name
    debug!("Waiting for SetName message from {addr}...");
    while let Some(Ok(message)) = receiver.next().await {
        if let Message::Text(text) = message {
            match serde_json::from_str::<Msg>(&text) {
                Ok(Msg {
                    content: MsgContent::SetName(new_name),
                    ..
                }) => {
                    let names = state.user_names.lock().unwrap().clone();
                    if names.values().any(|x| x == &new_name) {
                        let _ = sender.send(
                            Msg {
                                from: None,
                                to: None,
                                content: MsgContent::Error(ErrMsg {
                                    kind: ErrMsgKind::NameUnavailable,
                                    message: "Name is unavailable".into(),
                                }),
                            }
                            .into(),
                        );
                    } else {
                        name = new_name.clone();
                        break;
                    }
                }
                Ok(_) => {
                    warn!("Ignored command {text:?}");
                    let _ = sender.send(
                        Msg {
                            from: None,
                            to: None,
                            content: MsgContent::Error(ErrMsg {
                                kind: ErrMsgKind::MissingName,
                                message: "User name must be set before using other commands".into()
                            })
                        }.into(),
                    );
                }
                Err(err) => {
                    warn!("Invalid command {text:?}: {err}");
                    let _ = sender.send(
                        Msg {
                            from: None,
                            to: None,
                            content: MsgContent::Error(ErrMsg {
                                kind: ErrMsgKind::InvalidCommand,
                                message: format!(
                                    "Invalid command {text:?}: {err}"
                                ),
                            }),
                        }
                        .into(),
                    );
                }
            }
        }
    }

    // Update the state
    state.user_names.lock().unwrap().insert(id, name.clone());

    // Subscribe to the broadcast channel
    let mut rx = state.tx.subscribe();

    // Send a "joined" message to all broadcast subscribers
    let _ = state.tx.send(
        Msg {
            from: None,
            to: None,
            content: MsgContent::Joined(Joined {
                id,
                name: name.clone(),
            }),
        }
        .into(),
    );
    debug!("Sent joined message for {name}");

    // Create a context that can be shared with message handlers
    let tx = state.tx.clone();
    let context = Arc::new(Context {
        state: state.clone(),
        tx,
        id,
    });

    // Forward messages to the client; only forward broadcast messages (those
    // with an empty 'to' field) or messages addressed to the client
    let mut local_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            debug!("Handling message from queue: {msg:?}");
            let orig_msg = msg.clone();
            let result = if msg.to == Some(id) || msg.to.is_none() {
                sender.send(Message::Text(orig_msg.into())).await
            } else {
                Ok(())
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
    let _ = state.tx.send(
        Msg {
            to: None,
            from: None,
            content: MsgContent::Left(id),
        }
        .into(),
    );
    debug!("Sent left message for {id}");

    // Remove this client's name from the user name list
    state.user_names.lock().unwrap().remove(&id);
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
        }
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
async fn handle_msg(msg: Msg, context: &Arc<Context>) -> ControlFlow<(), ()> {
    let orig_msg = msg.clone();
    match msg {
        Msg {
            content: MsgContent::SetName(new_name),
            ..
        } => {
            let names = context.state.user_names.lock().unwrap().clone();
            let id = context.id.clone();

            if names.values().any(|x| x == &new_name) {
                // Requested name was not available
                let _ = context.tx.send(Msg {
                    to: Some(id),
                    from: None,
                    content: MsgContent::Error(ErrMsg {
                        kind: ErrMsgKind::NameUnavailable,
                        message: "Name is unavailable".into(),
                    }),
                });
            } else {
                // Notify everyone that the previous name has left
                let mut names =
                    context.state.user_names.lock().unwrap().clone();
                names.insert(id, new_name.clone());
                debug!("Set name to: {}", new_name);

                // Notify that the new name has joined
                let _ = context.tx.send(Msg {
                    from: None,
                    to: None,
                    content: MsgContent::Joined(Joined {
                        id,
                        name: new_name.clone(),
                    }),
                });
            }

            ControlFlow::Continue(())
        }
        Msg {
            content: MsgContent::Sync(_),
            ..
        } => {
            debug!("Got sync request from {:?} to {:?}", msg.from, msg.to);
            let _ = context.tx.send(orig_msg.into());
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

fn get_file(path: &str) -> Result<String, AppError> {
    let content = Public::get(path)
        .ok_or(AppError::Error("File not found".to_owned()))?;
    Ok(from_utf8(content.data.as_ref()).unwrap().to_string())
}
