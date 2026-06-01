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
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod logic;
mod models;
mod storage;

use crate::logic::deal::{deal_tasks, DealParams};
use crate::models::*;
use crate::storage::*;

struct AppState {
    vault: VaultPaths,
}

fn base_event_map(
    now: chrono::DateTime<chrono::Utc>,
    session_id: &str,
    device_id: Option<&str>,
    client_ts: Option<&str>,
) -> serde_json::Map<String, serde_json::Value> {
    let mut m = serde_json::Map::new();
    m.insert("schema_version".into(), serde_json::json!(1));
    m.insert(
        "event_id".into(),
        serde_json::json!(uuid::Uuid::new_v4().to_string()),
    );
    m.insert("ts".into(), serde_json::json!(now.to_rfc3339()));
    m.insert("session_id".into(), serde_json::json!(session_id));
    if let Some(did) = device_id {
        m.insert("device_id".into(), serde_json::json!(did));
    }
    if let Some(cts) = client_ts {
        m.insert("client_ts".into(), serde_json::json!(cts));
    }
    m
}

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG")
                .unwrap_or_else(|_| "housepage_rs=info,tower_http=debug".into()),
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
        .route("/api/tasks/upsert", post(tasks_upsert))
        .route("/api/tasks/delete", post(tasks_delete))
        .route("/api/checks/upsert", post(checks_upsert))
        .route("/api/checks/delete", post(checks_delete))
        .route("/api/health", get(get_health))
        .route("/api/metrics", get(get_metrics))
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

#[derive(Deserialize)]
struct DaysQuery {
    days: Option<i32>,
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
    let session_id = req
        .session_id
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    let now = Utc::now();
    for answer in req.answers {
        let mut map = base_event_map(
            now,
            &session_id,
            req.device_id.as_deref(),
            req.client_ts.as_deref(),
        );
        map.insert("type".into(), serde_json::json!("scan_answer"));
        map.insert("room".into(), serde_json::json!(&req.room));
        map.insert("check_id".into(), serde_json::json!(&answer.check_id));
        map.insert("answer".into(), serde_json::json!(&answer.answer));
        if let Err(e) = append_event(&state.vault.events_path(), &serde_json::Value::Object(map)) {
            return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
        }
    }

    (
        StatusCode::OK,
        Json(ScanSubmitResponse {
            ok: true,
            session_id,
        }),
    )
        .into_response()
}

async fn deal(
    State(state): State<Arc<AppState>>,
    Json(req): Json<DealRequest>,
) -> impl IntoResponse {
    let session_id = req
        .session_id
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let now = Utc::now();

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
        room: req.room.clone(),
        energy: req.energy,
        time_min: req.time_min,
        hand_size: req.hand_size,
    };

    let dealt = deal_tasks(
        &params,
        now,
        &tasks,
        &checks,
        &events,
        &HashSet::new(),
        None,
    );
    let task_ids: Vec<String> = dealt.iter().map(|t| t.task_id.clone()).collect();

    let mut map = base_event_map(
        now,
        &session_id,
        req.device_id.as_deref(),
        req.client_ts.as_deref(),
    );
    map.insert("type".into(), serde_json::json!("deal"));
    map.insert("room".into(), serde_json::json!(&req.room));
    map.insert("energy".into(), serde_json::json!(req.energy));
    map.insert("time_min".into(), serde_json::json!(req.time_min));
    map.insert("hand_size".into(), serde_json::json!(req.hand_size));
    map.insert("task_ids".into(), serde_json::json!(task_ids));
    if let Err(e) = append_event(&state.vault.events_path(), &serde_json::Value::Object(map)) {
        return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
    }

    (
        StatusCode::OK,
        Json(DealResponse {
            tasks: dealt,
            session_id,
        }),
    )
        .into_response()
}

async fn task_action(
    State(state): State<Arc<AppState>>,
    Json(req): Json<TaskActionRequest>,
) -> impl IntoResponse {
    let session_id = req
        .session_id
        .clone()
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let now = Utc::now();

    let event_type = match req.action.as_str() {
        "done" => "task_done",
        "skip" => "task_skip",
        _ => return (StatusCode::BAD_REQUEST, "Invalid action").into_response(),
    };

    let mut map = base_event_map(
        now,
        &session_id,
        req.device_id.as_deref(),
        req.client_ts.as_deref(),
    );
    map.insert("type".into(), serde_json::json!(event_type));
    map.insert("task_id".into(), serde_json::json!(&req.task_id));
    if let Some(ref room) = req.room {
        map.insert("room".into(), serde_json::json!(room));
    }
    if let Err(e) = append_event(&state.vault.events_path(), &serde_json::Value::Object(map)) {
        return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
    }

    // If replacement requested...
    let mut replacement_task = None;
    if let (Some(room), Some(energy), Some(time_min), Some(hand_size), Some(current_ids)) = (
        req.room,
        req.energy,
        req.time_min,
        req.hand_size,
        req.current_hand_task_ids,
    ) {
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
            room,
            energy,
            time_min,
            hand_size,
        };
        let mut exclude: HashSet<String> = current_ids.into_iter().collect();
        exclude.insert(req.task_id);

        let mut dealt = deal_tasks(&params, now, &tasks, &checks, &events, &exclude, None);
        if !dealt.is_empty() {
            replacement_task = Some(dealt.remove(0));
        }
    }

    (
        StatusCode::OK,
        Json(TaskActionResponse {
            ok: true,
            session_id,
            replacement_task,
        }),
    )
        .into_response()
}

async fn get_hashes(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let resp = DefHashesResponse {
        tasks_sha256: file_sha256(&state.vault.tasks_path()),
        checks_sha256: file_sha256(&state.vault.checks_path()),
        settings_sha256: file_sha256(&state.vault.settings_path()),
    };

    (StatusCode::OK, Json(resp)).into_response()
}

// ÔöÇÔöÇ Writeback helpers ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

fn upsert_value_array(
    root: &serde_json::Value,
    key: &str,
    new_item: &serde_json::Value,
) -> serde_json::Value {
    let mut root = root.clone();
    let arr = root
        .get_mut(key)
        .and_then(|v| v.as_array_mut())
        .expect("expected array");
    let new_id = new_item.get("id").and_then(|v| v.as_str());
    if let Some(id) = new_id {
        if let Some(existing) = arr
            .iter_mut()
            .find(|item| item.get("id").and_then(|v| v.as_str()) == Some(id))
        {
            if let (Some(obj), Some(src)) = (existing.as_object_mut(), new_item.as_object()) {
                for (k, v) in src {
                    obj.insert(k.clone(), v.clone());
                }
            }
            return root;
        }
    }
    arr.push(new_item.clone());
    root
}

fn delete_value_array(root: &serde_json::Value, key: &str, id: &str) -> serde_json::Value {
    let mut root = root.clone();
    if let Some(arr) = root.get_mut(key).and_then(|v| v.as_array_mut()) {
        arr.retain(|item| item.get("id").and_then(|v| v.as_str()) != Some(id));
    }
    root
}

fn validate_task(t: &Task) -> Result<(), String> {
    if t.id.trim().is_empty() {
        return Err("task.id must be non-empty".into());
    }
    if t.title.trim().is_empty() {
        return Err("task.title must be non-empty".into());
    }
    if !(1..=5).contains(&t.effort) {
        return Err("task.effort must be 1..=5".into());
    }
    if t.minutes_est < 1 {
        return Err("task.minutes_est must be positive".into());
    }
    if let Some(fd) = t.frequency_days {
        if fd < 1 {
            return Err("task.frequency_days must be positive".into());
        }
    }
    Ok(())
}

fn validate_check(c: &Check) -> Result<(), String> {
    if c.id.trim().is_empty() {
        return Err("check.id must be non-empty".into());
    }
    if c.prompt.trim().is_empty() {
        return Err("check.prompt must be non-empty".into());
    }
    Ok(())
}

fn check_precondition(
    path: &std::path::Path,
    if_match: &Option<String>,
) -> Result<(), ErrConflictResponse> {
    if let Some(expected) = if_match {
        let current = file_sha256(path);
        if current != *expected {
            return Err(ErrConflictResponse {
                error: "precondition_failed".to_string(),
                expected_sha256: expected.clone(),
                current_sha256: current,
            });
        }
    }
    Ok(())
}

// ÔöÇÔöÇ Writeback route handlers ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

async fn tasks_upsert(
    State(state): State<Arc<AppState>>,
    Json(req): Json<TaskUpsertRequest>,
) -> impl IntoResponse {
    if let Err(msg) = validate_task(&req.task) {
        return (StatusCode::BAD_REQUEST, msg).into_response();
    }
    if let Err(conflict) = check_precondition(&state.vault.tasks_path(), &req.if_match_sha256) {
        return (StatusCode::CONFLICT, Json(conflict)).into_response();
    }
    let backups = state.vault.root.join("backups");
    let _ = backup_file(&state.vault.tasks_path(), &backups);
    let root = match read_json::<serde_json::Value>(&state.vault.tasks_path()) {
        Ok(v) => v,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };
    let new_item = serde_json::to_value(&req.task).unwrap();
    let updated = upsert_value_array(&root, "tasks", &new_item);
    match atomic_write_json(&state.vault.tasks_path(), &updated) {
        Ok(sha) => (
            StatusCode::OK,
            Json(WriteResponse {
                ok: true,
                sha256: sha,
            }),
        )
            .into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn tasks_delete(
    State(state): State<Arc<AppState>>,
    Json(req): Json<TaskDeleteRequest>,
) -> impl IntoResponse {
    if let Err(conflict) = check_precondition(&state.vault.tasks_path(), &req.if_match_sha256) {
        return (StatusCode::CONFLICT, Json(conflict)).into_response();
    }
    let backups = state.vault.root.join("backups");
    let _ = backup_file(&state.vault.tasks_path(), &backups);
    let root = match read_json::<serde_json::Value>(&state.vault.tasks_path()) {
        Ok(v) => v,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };
    let updated = delete_value_array(&root, "tasks", &req.task_id);
    match atomic_write_json(&state.vault.tasks_path(), &updated) {
        Ok(sha) => (
            StatusCode::OK,
            Json(WriteResponse {
                ok: true,
                sha256: sha,
            }),
        )
            .into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn checks_upsert(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CheckUpsertRequest>,
) -> impl IntoResponse {
    if let Err(msg) = validate_check(&req.check) {
        return (StatusCode::BAD_REQUEST, msg).into_response();
    }
    if let Err(conflict) = check_precondition(&state.vault.checks_path(), &req.if_match_sha256) {
        return (StatusCode::CONFLICT, Json(conflict)).into_response();
    }
    let backups = state.vault.root.join("backups");
    let _ = backup_file(&state.vault.checks_path(), &backups);
    let root = match read_json::<serde_json::Value>(&state.vault.checks_path()) {
        Ok(v) => v,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };
    let new_item = serde_json::to_value(&req.check).unwrap();
    let updated = upsert_value_array(&root, "checks", &new_item);
    match atomic_write_json(&state.vault.checks_path(), &updated) {
        Ok(sha) => (
            StatusCode::OK,
            Json(WriteResponse {
                ok: true,
                sha256: sha,
            }),
        )
            .into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn checks_delete(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CheckDeleteRequest>,
) -> impl IntoResponse {
    if let Err(conflict) = check_precondition(&state.vault.checks_path(), &req.if_match_sha256) {
        return (StatusCode::CONFLICT, Json(conflict)).into_response();
    }
    let backups = state.vault.root.join("backups");
    let _ = backup_file(&state.vault.checks_path(), &backups);
    let root = match read_json::<serde_json::Value>(&state.vault.checks_path()) {
        Ok(v) => v,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };
    let updated = delete_value_array(&root, "checks", &req.check_id);
    match atomic_write_json(&state.vault.checks_path(), &updated) {
        Ok(sha) => (
            StatusCode::OK,
            Json(WriteResponse {
                ok: true,
                sha256: sha,
            }),
        )
            .into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn get_health(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let vault_dir = state
        .vault
        .root
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let body = serde_json::json!({
        "ok": true,
        "version": "0.1.0",
        "vault_dir": vault_dir,
    });
    (StatusCode::OK, Json(body)).into_response()
}

async fn get_metrics(
    State(state): State<Arc<AppState>>,
    Query(q): Query<DaysQuery>,
) -> impl IntoResponse {
    let days = q.days.unwrap_or(30);

    let tasks = match read_json::<TasksFile>(&state.vault.tasks_path()) {
        Ok(t) => t.tasks,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };
    let checks = match read_json::<ChecksFile>(&state.vault.checks_path()) {
        Ok(c) => c.checks,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };
    let events = crate::logic::derive::read_events(&state.vault.events_path());

    let tasks_by_id = crate::logic::metrics::build_tasks_lookup(&tasks);
    let checks_by_id = crate::logic::metrics::build_checks_lookup(&checks);

    let result = crate::logic::metrics::compute_metrics(
        Utc::now(),
        days,
        &tasks_by_id,
        &checks_by_id,
        &events,
        12,
    );

    let resp = serde_json::json!({
        "days": result.days,
        "range": {
            "from": result.range_from,
            "to": result.range_to,
        },
        "tasks_done_total": result.tasks_done_total,
        "tasks_done_by_day": result.tasks_done_by_day.into_iter().map(|(day, count)| {
            serde_json::json!({"day": day, "count": count})
        }).collect::<Vec<_>>(),
        "tasks_done_by_room": result.tasks_done_by_room.into_iter().map(|(room, count)| {
            serde_json::json!({"room": room, "count": count})
        }).collect::<Vec<_>>(),
        "tasks_done_top": result.tasks_done_top.into_iter().map(|(task_id, title, room, count)| {
            serde_json::json!({"task_id": task_id, "title": title, "room": room, "count": count})
        }).collect::<Vec<_>>(),
        "deals_total": result.deals_total,
        "time_bucket_avg": result.time_bucket_avg,
        "time_bucket_counts": result.time_bucket_counts.into_iter().map(|(time_min, count)| {
            serde_json::json!({"time_min": time_min, "count": count})
        }).collect::<Vec<_>>(),
        "scans_total": result.scans_total,
        "checks_no_total": result.checks_no_total,
        "checks_no_by_room": result.checks_no_by_room.into_iter().map(|(room, count)| {
            serde_json::json!({"room": room, "count": count})
        }).collect::<Vec<_>>(),
        "checks_no_top": result.checks_no_top.into_iter().map(|(check_id, prompt, room, count)| {
            serde_json::json!({"check_id": check_id, "prompt": prompt, "room": room, "count": count})
        }).collect::<Vec<_>>(),
    });

    (StatusCode::OK, Json(resp)).into_response()
}
