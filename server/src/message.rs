use axum::extract::ws::Message;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SetName {
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
    SetName(SetName),
    Sync(Sync),
    Joined(String),
    Left(String),
    Error(ErrMsg),
    Version(u64),
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Msg {
    pub(crate) to: String,
    pub(crate) from: String,
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
