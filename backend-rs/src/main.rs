use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use serde::Deserialize;
use std::collections::HashSet;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::fs;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod models;
mod storage;
mod logic;

use crate::models::*;
use crate::storage::*;
use crate::logic::deal::{deal_tasks, DealParams};

struct AppState {
    vault: VaultPaths,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "housepage_rs=info,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let vault_path = std::env::var("CHORE_VAULT_PATH").unwrap_or_else(|_| {
        // Fallback to vault_sample relative to workspace root
        "vault_sample/chore_system".to_string()
    });
    
    let state = Arc::new(AppState {
        vault: VaultPaths::new(PathBuf::from(vault_path)),
    });

    let app = Router::new()
        .route("/api/settings", get(get_settings))
        .route("/api/tasks", get(get_tasks))
        .route("/api/checks", get(get_checks_for_room))
        .route("/api/checks/all", get(get_all_checks))
        .route("/api/scan/submit", post(submit_scan))
        .route("/api/deal", post(deal))
        .route("/api/task/action", post(task_action))
        .route("/api/defs/hashes", get(get_hashes))
        .with_state(state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let port = std::env::var("CHORE_PORT").unwrap_or_else(|_| "8000".to_string());
    let addr = SocketAddr::from(([0, 0, 0, 0], port.parse().unwrap()));
    
    tracing::info!("Housepage Rust listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn get_settings(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match read_json::<Settings>(&state.vault.settings_path()) {
        Ok(s) => (StatusCode::OK, Json(s)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn get_tasks(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match read_json::<TasksFile>(&state.vault.tasks_path()) {
        Ok(t) => (StatusCode::OK, Json(t)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

#[derive(Deserialize)]
struct RoomQuery {
    room: String,
}

async fn get_checks_for_room(
    State(state): State<Arc<AppState>>,
    Query(q): Query<RoomQuery>,
) -> impl IntoResponse {
    match read_json::<ChecksFile>(&state.vault.checks_path()) {
        Ok(cf) => {
            let filtered: Vec<Check> = cf.checks.into_iter().filter(|c| c.room == q.room).collect();
            let resp = serde_json::json!({
                "schema_version": cf.schema_version,
                "room": q.room,
                "checks": filtered
            });
            (StatusCode::OK, Json(resp)).into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn get_all_checks(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match read_json::<ChecksFile>(&state.vault.checks_path()) {
        Ok(cf) => (StatusCode::OK, Json(cf)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn submit_scan(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ScanSubmitRequest>,
) -> impl IntoResponse {
    let session_id = req.session_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    
    let now = Utc::now();
    for answer in req.answers {
        let event = serde_json::json!({
            "type": "scan_answer",
            "ts": now.to_rfc3339(),
            "room": req.room,
            "check_id": answer.check_id,
            "answer": answer.answer,
            "session_id": session_id,
            "device_id": req.device_id,
        });
        if let Err(e) = append_event(&state.vault.events_path(), &event) {
            return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
        }
    }
    
    (StatusCode::OK, Json(ScanSubmitResponse { ok: true, session_id })).into_response()
}

async fn deal(
    State(state): State<Arc<AppState>>,
    Json(req): Json<DealRequest>,
) -> impl IntoResponse {
    let session_id = req.session_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    
    let tasks = match read_json::<TasksFile>(&state.vault.tasks_path()) {
        Ok(t) => t.tasks,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };
    let checks = match read_json::<ChecksFile>(&state.vault.checks_path()) {
        Ok(c) => c.checks,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };
    let events = crate::logic::derive::read_events(&state.vault.events_path());

    let params = DealParams {
        room: req.room,
        energy: req.energy,
        time_min: req.time_min,
        hand_size: req.hand_size,
    };
    
    let dealt = deal_tasks(&params, Utc::now(), &tasks, &checks, &events, &HashSet::new(), None);
    
    (StatusCode::OK, Json(DealResponse { tasks: dealt, session_id })).into_response()
}

async fn task_action(
    State(state): State<Arc<AppState>>,
    Json(req): Json<TaskActionRequest>,
) -> impl IntoResponse {
    let session_id = req.session_id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let now = Utc::now();
    
    let event_type = match req.action.as_str() {
        "done" => "task_done",
        "skip" => "task_skip",
        _ => return (StatusCode::BAD_REQUEST, "Invalid action").into_response(),
    };
    
    let event = serde_json::json!({
        "type": event_type,
        "ts": now.to_rfc3339(),
        "task_id": req.task_id,
        "room": req.room,
        "session_id": session_id,
        "device_id": req.device_id,
    });
    
    if let Err(e) = append_event(&state.vault.events_path(), &event) {
        return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
    }
    
    // If replacement requested...
    let mut replacement_task = None;
    if let (Some(room), Some(energy), Some(time_min), Some(hand_size), Some(current_ids)) = 
        (req.room, req.energy, req.time_min, req.hand_size, req.current_hand_task_ids) {
            
        let tasks = match read_json::<TasksFile>(&state.vault.tasks_path()) {
            Ok(t) => t.tasks,
            Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
        };
        let checks = match read_json::<ChecksFile>(&state.vault.checks_path()) {
            Ok(c) => c.checks,
            Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
        };
        let events = crate::logic::derive::read_events(&state.vault.events_path());
        
        let params = DealParams { room, energy, time_min, hand_size };
        let mut exclude: HashSet<String> = current_ids.into_iter().collect();
        exclude.insert(req.task_id);
        
        let mut dealt = deal_tasks(&params, now, &tasks, &checks, &events, &exclude, None);
        if !dealt.is_empty() {
            replacement_task = Some(dealt.remove(0));
        }
    }
    
    (StatusCode::OK, Json(TaskActionResponse { ok: true, session_id, replacement_task })).into_response()
}

async fn get_hashes(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    use sha2::{Sha256, Digest};
    
    let calculate_sha = |path: &std::path::Path| -> String {
        let content = fs::read(path).unwrap_or_default();
        let mut hasher = Sha256::new();
        hasher.update(content);
        hex::encode(hasher.finalize())
    };
    
    let resp = DefHashesResponse {
        tasks_sha256: calculate_sha(&state.vault.tasks_path()),
        checks_sha256: calculate_sha(&state.vault.checks_path()),
        settings_sha256: calculate_sha(&state.vault.settings_path()),
    };
    
    (StatusCode::OK, Json(resp)).into_response()
}

// Add read_events to logic/derive.rs for easier access
// I'll update derive.rs in the next step or should have included it.
// Actually I'll implement it here or move it to storage.
