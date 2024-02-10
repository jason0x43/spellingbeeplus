use std::env::VarError;

use axum::{
    http::{header::ToStrError, StatusCode},
    response::{IntoResponse, Response},
};
use handlebars::RenderError;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("error: {0}")]
    Error(String),

    #[error("Unauthorized")]
    Unauthorized(),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        match self {
            AppError::Error(err) => {
                (StatusCode::INTERNAL_SERVER_ERROR, err).into_response()
            }
            AppError::Unauthorized() => {
                StatusCode::UNAUTHORIZED.into_response()
            }
        }
    }
}

impl From<ToStrError> for AppError {
    fn from(err: ToStrError) -> Self {
        AppError::Error(format!("{}", err))
    }
}

impl From<uuid::Error> for AppError {
    fn from(err: uuid::Error) -> Self {
        AppError::Error(format!("{}", err))
    }
}

impl From<VarError> for AppError {
    fn from(err: VarError) -> Self {
        AppError::Error(format!("{}", err))
    }
}

impl From<RenderError> for AppError {
    fn from(err: RenderError) -> Self {
        AppError::Error(format!("{}", err))
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::Error(format!("{}", err))
    }
}
