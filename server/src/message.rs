use axum::extract::ws::Message;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Connect {
    pub(crate) version: u64,
    pub(crate) id: Uuid,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Left {
    pub(crate) id: Uuid,
    pub(crate) name: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Joined {
    pub(crate) id: Uuid,
    pub(crate) name: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Sync {
    pub(crate) request_id: String,
    pub(crate) words: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ErrMsgKind {
    NameUnavailable,
    MissingName,
    InvalidCommand,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ErrMsg {
    pub(crate) kind: ErrMsgKind,
    pub(crate) message: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MsgContent {
    Connect(Connect),
    SetName(String),
    Sync(Sync),
    Joined(Joined),
    Left(Left),
    Error(ErrMsg),
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Msg {
    pub(crate) to: Option<Uuid>,
    pub(crate) from: Option<Uuid>,
    pub(crate) content: MsgContent,
}

impl From<Msg> for String {
    fn from(msg: Msg) -> Self {
        serde_json::to_string(&msg).unwrap()
    }
}

impl From<Msg> for Message {
    fn from(msg: Msg) -> Self {
        Message::Text(serde_json::to_string(&msg).unwrap())
    }
}
