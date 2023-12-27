use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SetName {
    pub(crate) name: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Sync {
    pub(crate) to: String,
    pub(crate) from: String,
    pub(crate) request_id: String,
    pub(crate) words: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum Msg {
    SetName(SetName),
    Sync(Sync),
    Joined(String),
    Left(String),
    Error(String),
}

impl From<Msg> for String {
    fn from(msg: Msg) -> Self {
        serde_json::to_string(&msg).unwrap()
    }
}
