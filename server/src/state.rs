use std::{collections::HashMap, sync::Mutex};
use tokio::sync::broadcast;
use uuid::Uuid;

use crate::message::Msg;

pub(crate) struct AppState {
    pub(crate) version: u64,
    pub(crate) user_names: Mutex<HashMap<Uuid, String>>,
    pub(crate) tx: broadcast::Sender<Msg>,
}
