use axum::{
    extract::{
        ws::{Message as WsMessage, WebSocket},
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
use uuid::{uuid, Uuid};

use crate::{
    error::AppError,
    message::{
        Connect, ErrMsg, ErrMsgKind, InternalMessage, Joined, MessageContent,
        MessageFrom, MessageTo,
    },
    types::{ApiKey, AppState, AuthToken, ExpiryTime, TokenResponse},
};

#[derive(RustEmbed)]
#[folder = "public/"]
struct Public;

#[derive(RustEmbed)]
#[folder = "templates/"]
struct Templates;

struct Context {
    state: Arc<AppState>,
    id: Uuid,
    tx: Sender<InternalMessage>,
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
    let index_tmpl = get_template("index.html")?;
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

static SERVER_ID: Uuid = uuid!("00000000-0000-0000-0000-000000000000");

/// Handle a new WebSocket connection
async fn handle_connection(
    socket: WebSocket,
    addr: SocketAddr,
    state: Arc<AppState>,
) {
    // Split the socket so we can send and receive at the same time
    let (mut sender, mut receiver) = socket.split();

    // Create a variable to hold this client's name
    let mut name = String::new();
    // Create a new ID for this client
    let mut client_id = Uuid::new_v4();

    debug!("Connected client at {addr}, assigning ID {client_id}");

    // Send the client a unique ID for it to use, along with the current server
    // version, which may cause the client to reload
    let result = sender
        .send(
            MessageFrom {
                from: SERVER_ID,
                content: MessageContent::Connect(Connect {
                    version: state.version,
                    id: client_id,
                }),
            }
            .into(),
        )
        .await;
    if let Err(err) = result {
        warn!("Error sending connect message: {err}");
    }

    // Tell the new client about any existing clients
    let names = state.clients.lock().unwrap().clone();
    debug!("Names: {names:?}");
    for (id, name) in names {
        if sender
            .send(
                MessageFrom {
                    from: SERVER_ID,
                    content: MessageContent::Joined(Joined {
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
    while name.is_empty() {
        debug!("Waiting for SetName message from {client_id}...");
        let message = match receiver.next().await {
            Some(Ok(msg)) => msg,
            Some(Err(msg)) => {
                warn!("Error receiving message: {msg}");
                break;
            }
            None => {
                warn!("Channel is closed");
                break;
            }
        };

        if let WsMessage::Text(text) = message {
            match serde_json::from_str::<MessageTo>(&text) {
                Ok(MessageTo {
                    content: MessageContent::SetClientId(new_client_id),
                    to: None,
                }) => {
                    client_id = new_client_id;
                    debug!("Set client ID to: {}", client_id);
                }
                Ok(MessageTo {
                    content: MessageContent::SetName(new_name),
                    to: None,
                }) => {
                    debug!("Got SetName message for {client_id}: {new_name}");

                    let clients = state.clients.lock().unwrap().clone();
                    if clients.values().any(|x| x == &new_name) {
                        let id =
                            clients.iter().find(|(_, name)| *name == &new_name);
                        let mut needs_update = true;
                        if let Some((id, _)) = id {
                            if *id == client_id {
                                needs_update = false;
                            }
                        }

                        if needs_update {
                            let result = sender
                                .send(
                                    MessageFrom {
                                        from: SERVER_ID,
                                        content: MessageContent::Error(
                                            ErrMsg {
                                                kind:
                                                    ErrMsgKind::NameUnavailable,
                                                message: "Name is unavailable"
                                                    .into(),
                                            },
                                        ),
                                    }
                                    .into(),
                                )
                                .await;
                            if let Err(result) = result {
                                warn!(
                                    "Error sending message to client: {}",
                                    result
                                );
                            }
                            debug!("Name '{new_name}' was already in use, asked for another name from {client_id}");
                        } else {
                            debug!("Name '{new_name}' is already assigned to {client_id} ");
                            name = new_name.clone();
                        }
                    } else {
                        name = new_name.clone();
                        debug!("Set {client_id}'s name to {name}");
                    }
                }
                Ok(_) => {
                    warn!("Ignored command {text:?}");
                    let result = sender.send(
                        MessageFrom {
                            from: SERVER_ID,
                            content: MessageContent::Error(ErrMsg {
                                kind: ErrMsgKind::MissingName,
                                message: "User name must be set before using other commands".into()
                            })
                        }.into(),
                    ).await;
                    if let Err(result) = result {
                        warn!("Error sending message to client: {result}");
                    }
                }
                Err(err) => {
                    warn!("Invalid command {text:?}: {err}");
                    let result = sender
                        .send(
                            MessageFrom {
                                from: SERVER_ID,
                                content: MessageContent::Error(ErrMsg {
                                    kind: ErrMsgKind::InvalidCommand,
                                    message: format!(
                                        "Invalid command {text:?}: {err}"
                                    ),
                                }),
                            }
                            .into(),
                        )
                        .await;
                    if let Err(result) = result {
                        warn!("Error sending message to client: {result}");
                    }
                }
            }
        }
    }

    if name.is_empty() {
        warn!("Channel errored without setting name for {client_id}");
        return;
    }

    debug!("Name has been set for {client_id}: {name}");

    // Update the state
    state
        .clients
        .lock()
        .unwrap()
        .insert(client_id, name.clone());
    debug!("Added {client_id} the client list");

    // Subscribe to the broadcast channel
    let mut rx = state.tx.subscribe();

    // Send a "joined" message to all broadcast subscribers
    let _ = state.tx.send(InternalMessage {
        from: SERVER_ID,
        to: None,
        content: MessageContent::Joined(Joined {
            id: client_id,
            name: name.clone(),
        }),
    });
    debug!("Sent joined message for {client_id} ({name})");

    // Create a context that can be shared with message handlers
    let tx = state.tx.clone();
    let context = Arc::new(Context {
        state: state.clone(),
        tx,
        id: client_id,
    });

    // Forward messages to the client; only forward broadcast messages (those
    // with an empty 'to' field) or messages addressed to the client
    let mut local_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            debug!("Handling message from queue: {msg:?}");
            let result = if msg.to == Some(client_id) || msg.to.is_none() {
                sender
                    .send(
                        MessageFrom {
                            from: msg.from,
                            content: msg.content,
                        }
                        .into(),
                    )
                    .await
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

    // Wait for one of the send/recv tasks to stop and then kill the other one
    tokio::select! {
        _ = (&mut local_task) => recv_task.abort(),
        _ = (&mut recv_task) => local_task.abort(),
    }

    // Let subscribers know that this client has left
    let _ = state.tx.send(InternalMessage {
        to: None,
        from: SERVER_ID,
        content: MessageContent::Left(client_id),
    });
    debug!("Sent left message for {client_id}");

    // Remove this client's name from the user name list
    state.clients.lock().unwrap().remove(&client_id);
    debug!("Removed {client_id} from the clients list");
}

/// Handle an incoming WebSocket message
async fn handle_message(
    msg: WsMessage,
    context: &Arc<Context>,
) -> ControlFlow<(), ()> {
    match msg {
        WsMessage::Close(_) => {
            debug!("Received close message");
            ControlFlow::Break(())
        }
        WsMessage::Text(msg) => {
            match serde_json::from_str::<MessageTo>(&msg) {
                Ok(msg) => {
                    handle_msg(
                        InternalMessage {
                            from: context.id,
                            to: msg.to,
                            content: msg.content,
                        },
                        context,
                    )
                    .await;
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
    msg: InternalMessage,
    context: &Arc<Context>,
) -> ControlFlow<(), ()> {
    match msg {
        InternalMessage {
            content: MessageContent::SetName(new_name),
            ..
        } => {
            let names = context.state.clients.lock().unwrap().clone();
            let id = context.id;

            if names.values().any(|x| x == &new_name) {
                // Requested name was not available
                let _ = context.tx.send(InternalMessage {
                    to: Some(id),
                    from: SERVER_ID,
                    content: MessageContent::Error(ErrMsg {
                        kind: ErrMsgKind::NameUnavailable,
                        message: "Name is unavailable".into(),
                    }),
                });
            } else {
                let mut names = context.state.clients.lock().unwrap().clone();
                names.insert(id, new_name.clone());
                debug!("Set name to: {}", new_name);

                // Notify that the new name has joined
                let _ = context.tx.send(InternalMessage {
                    to: None,
                    from: SERVER_ID,
                    content: MessageContent::Joined(Joined {
                        id,
                        name: new_name.clone(),
                    }),
                });
            }

            ControlFlow::Continue(())
        }
        InternalMessage {
            content: MessageContent::Sync(_),
            to,
            from,
        } => {
            debug!("Got sync request from {:?} to {:?}", from, to);
            let _ = context.tx.send(msg);
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

/// Load a template file
fn get_template(path: &str) -> Result<String, AppError> {
    let content = Templates::get(path)
        .ok_or(AppError::Error("File not found".to_owned()))?;
    Ok(from_utf8(content.data.as_ref()).unwrap().to_string())
}
