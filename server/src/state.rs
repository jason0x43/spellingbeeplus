use std::{collections::HashSet, sync::Mutex};
use tokio::sync::broadcast;

use crate::message::Msg;

pub(crate) struct AppState {
    pub(crate) version: u64,
    pub(crate) user_names: Mutex<HashSet<String>>,
    pub(crate) tx: broadcast::Sender<Msg>,
}
