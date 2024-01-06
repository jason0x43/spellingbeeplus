use std::sync::Arc;

use axum::{
    async_trait,
    extract::{FromRequestParts, Query},
    http::request::Parts,
    response::{IntoResponse, Response},
};
use uuid::Uuid;

use crate::{
    error::AppError,
    types::{ApiKey, AppState, AuthToken, TokenQuery},
};

/// An extractor to retrieve the current ApiKey
#[async_trait]
impl FromRequestParts<Arc<AppState>> for ApiKey {
    type Rejection = Response;

    async fn from_request_parts(
        parts: &mut Parts,
        _state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        let headers = parts.headers.clone();
        let api_key = headers.get("x-api-key");
        if let Some(api_key) = api_key {
            let key_str = api_key
                .to_str()
                .map_err(|_| AppError::Unauthorized().into_response())?;
            let uuid = Uuid::parse_str(key_str)
                .map_err(|_| AppError::Unauthorized().into_response())?;
            Ok(ApiKey(uuid))
        } else {
            Err(AppError::Unauthorized().into_response())
        }
    }
}

/// An extractor to retrieve the current auth token
#[async_trait]
impl FromRequestParts<Arc<AppState>> for AuthToken {
    type Rejection = Response;

    async fn from_request_parts(
        parts: &mut Parts,
        _state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        let query: Query<TokenQuery> = Query::try_from_uri(&parts.uri)
            .map_err(|_| AppError::Unauthorized().into_response())?;
        Ok(query.token.clone())
    }
}
