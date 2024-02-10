mod error;
mod extractors;
mod handlers;
mod message;
mod types;

use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

use axum::{
    http::{header, request, HeaderName, HeaderValue},
    routing::get,
    Router,
};
use error::AppError;
use tokio::sync::broadcast;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};
use tracing::info;

use crate::types::{ApiKey, AppState};

#[tokio::main]
async fn main() -> Result<(), AppError> {
    tracing_subscriber::fmt::init();

    let api_key: ApiKey = std::env::var("API_KEY")?.try_into()?;
    let clients = Mutex::new(HashMap::new());
    let auth_tokens = Mutex::new(HashMap::new());
    let (tx, _rx) = broadcast::channel(100);
    let version = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as u32;
    let app_state = Arc::new(AppState {
        api_key,
        auth_tokens,
        clients,
        tx,
        version,
    });

    let api = Router::new().route("/hello", get(handlers::hello));
    let mut router = Router::new()
        .route("/token", get(handlers::token))
        .route("/ws", get(handlers::ws))
        .nest("/api", api);

    if cfg!(debug_assertions) {
        router = router
            .route("/", get(handlers::root))
            .route("/index.html", get(handlers::index));
    }

    let app = router
        .fallback(handlers::public_files)
        .with_state(app_state)
        .layer(
            CorsLayer::new()
                .allow_origin(AllowOrigin::predicate(
                    |_origin: &HeaderValue, _request_parts: &request::Parts| {
                        true
                    },
                ))
                .allow_credentials(true)
                .allow_headers(vec![
                    header::CONTENT_TYPE,
                    HeaderName::from_static("x-api-key"),
                ]),
        )
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
