use axum::{response::{IntoResponse, Response}, http::StatusCode};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("error: {0}")]
    Error(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        match self {
            AppError::Error(err) => {
                (StatusCode::INTERNAL_SERVER_ERROR, err).into_response()
            }
        }
    }
}
