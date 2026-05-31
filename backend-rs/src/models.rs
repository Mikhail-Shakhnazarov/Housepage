use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub room: String,
    pub effort: i32,
    pub minutes_est: i32,
    pub frequency_days: Option<i32>,
    pub kind: String,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TasksFile {
    pub schema_version: i32,
    pub tasks: Vec<Task>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Check {
    pub id: String,
    pub room: String,
    pub prompt: String,
    pub linked_task_ids: Vec<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChecksFile {
    pub schema_version: i32,
    pub checks: Vec<Check>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Room {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Defaults {
    pub hand_size: i32,
    pub scan_first: bool,
    pub time_buckets_min: Vec<i32>,
    pub energy_scale: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Settings {
    pub schema_version: i32,
    pub defaults: Defaults,
    pub rooms: Vec<Room>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanAnswer {
    pub check_id: String,
    pub answer: String, // "yes" or "no"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanSubmitRequest {
    pub room: String,
    pub answers: Vec<ScanAnswer>,
    pub session_id: Option<String>,
    pub device_id: Option<String>,
    pub client_ts: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanSubmitResponse {
    pub ok: bool,
    pub session_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DealRequest {
    pub room: String,
    pub energy: i32,
    pub time_min: i32,
    pub hand_size: i32,
    pub session_id: Option<String>,
    pub device_id: Option<String>,
    pub client_ts: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DealTaskView {
    pub task_id: String,
    pub title: String,
    pub room: String,
    pub effort: i32,
    pub minutes_est: i32,
    pub score: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DealResponse {
    pub tasks: Vec<DealTaskView>,
    pub session_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TaskActionRequest {
    pub task_id: String,
    pub action: String, // "done" or "skip"
    pub room: Option<String>,
    pub energy: Option<i32>,
    pub time_min: Option<i32>,
    pub hand_size: Option<i32>,
    pub session_id: Option<String>,
    pub device_id: Option<String>,
    pub client_ts: Option<String>,
    pub current_hand_task_ids: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TaskActionResponse {
    pub ok: bool,
    pub session_id: String,
    pub replacement_task: Option<DealTaskView>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DefHashesResponse {
    pub tasks_sha256: String,
    pub checks_sha256: String,
    pub settings_sha256: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TaskUpsertRequest {
    pub task: Task,
    pub if_match_sha256: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WriteResponse {
    pub ok: bool,
    pub sha256: String,
}
