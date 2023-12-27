use std::{
    collections::HashSet,
    net::SocketAddr,
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

use axum::{routing::get, Router};
use error::AppError;
use tokio::sync::broadcast;
use tower_http::trace::TraceLayer;
use tracing::info;

use crate::state::AppState;

mod error;
mod handlers;
mod message;
mod state;

#[tokio::main]
async fn main() -> Result<(), AppError> {
    tracing_subscriber::fmt::init();

    let api = Router::new().route("/hello", get(handlers::hello));

    let user_names = Mutex::new(HashSet::new());
    let (tx, _rx) = broadcast::channel(100);
    let version = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let app_state = Arc::new(AppState {
        user_names,
        tx,
        version,
    });

    let app = Router::new()
        .route("/ws", get(handlers::ws))
        .nest("/api", api)
        .route("/", get(handlers::root))
        .fallback(handlers::public_files)
        .with_state(app_state)
        .layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3003")
        .await
        .unwrap();
    let addr = listener.local_addr().unwrap();
    let server = axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    );

    info!("Listening on {}...", addr);

    server
        .await
        .map_err(|err| AppError::Error(err.to_string()))?;

    Ok(())
}
