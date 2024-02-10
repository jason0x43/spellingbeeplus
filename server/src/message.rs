use axum::extract::ws::Message as WsMessage;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub(crate) struct Connect {
    pub(crate) version: u32,
    pub(crate) id: Uuid,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub(crate) struct Joined {
    pub(crate) id: Uuid,
    pub(crate) name: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub(crate) struct Sync {
    pub(crate) request_id: String,
    pub(crate) words: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub(crate) enum ErrMsgKind {
    #[ts(rename="nameUnavailable")]
    NameUnavailable,
    #[ts(rename="missingName")]
    MissingName,
    #[ts(rename="invalidCommand")]
    InvalidCommand,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub(crate) struct ErrMsg {
    pub(crate) kind: ErrMsgKind,
    pub(crate) message: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub(crate) enum MessageContent {
    Connect(Connect),
    #[ts(rename = "setName")]
    SetName(String),
    #[ts(rename = "setClientId")]
    SetClientId(Uuid),
    Sync(Sync),
    Joined(Joined),
    Left(Uuid),
    Error(ErrMsg),
}

/// An outgoing message
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub(crate) struct MessageFrom {
    pub(crate) from: Uuid,
    pub(crate) content: MessageContent,
}

impl From<MessageFrom> for WsMessage {
    fn from(msg: MessageFrom) -> Self {
        WsMessage::Text(serde_json::to_string(&msg).unwrap())
    }
}

/// An incoming message
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub(crate) struct MessageTo {
    pub(crate) to: Option<Uuid>,
    pub(crate) content: MessageContent,
}

/// An internal message with both sender and receiver
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub(crate) struct InternalMessage {
    pub(crate) to: Option<Uuid>,
    pub(crate) from: Uuid,
    pub(crate) content: MessageContent,
}
