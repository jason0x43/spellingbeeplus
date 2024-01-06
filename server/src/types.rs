use axum::http::HeaderValue;
use serde::{Serialize, Deserialize};
use std::{
    collections::HashMap,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::sync::broadcast;
use uuid::Uuid;

use crate::{error::AppError, message::Msg};

#[derive(Clone, Eq, Hash, PartialEq, Serialize, Deserialize)]
pub(crate) struct AuthToken(Uuid);

impl AuthToken {
    pub(crate) fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

#[derive(Clone)]
pub(crate) struct ExpiryTime(u64);

impl ExpiryTime {
    pub(crate) fn new() -> Self {
        Self(
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs()
                + 10,
        )
    }

    pub(crate) fn is_expired(&self) -> bool {
        self.0
            < SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs()
    }
}

pub(crate) struct AppState {
    pub(crate) api_key: ApiKey,
    pub(crate) version: u64,
    pub(crate) auth_tokens: Mutex<HashMap<AuthToken, ExpiryTime>>,
    pub(crate) user_names: Mutex<HashMap<Uuid, String>>,
    pub(crate) tx: broadcast::Sender<Msg>,
}

#[derive(Clone, Serialize, PartialEq)]
pub(crate) struct ApiKey(pub(crate) Uuid);

impl TryFrom<&HeaderValue> for ApiKey {
    type Error = AppError;

    fn try_from(value: &HeaderValue) -> Result<Self, Self::Error> {
        let val = value.to_str()?;
        let uuid = Uuid::try_from(val)?;
        Ok(ApiKey(uuid))
    }
}

impl TryFrom<String> for ApiKey {
    type Error = AppError;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        let uuid = Uuid::try_from(value.as_str())?;
        Ok(ApiKey(uuid))
    }
}

#[derive(Serialize)]
pub(crate) struct TokenResponse {
    pub(crate) token: AuthToken,
}

#[derive(Deserialize)]
pub(crate) struct TokenQuery {
    pub(crate) token: AuthToken,
}
