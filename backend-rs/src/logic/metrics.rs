use chrono::{DateTime, Duration, Utc};
use serde_json::Value;
use std::collections::HashMap;

use crate::logic::derive::parse_event_ts;
use crate::models::{Check, Task};

fn utc_day_key(ts: DateTime<Utc>) -> String {
    ts.format("%Y-%m-%d").to_string()
}

fn days_from(now: DateTime<Utc>, days: i32) -> DateTime<Utc> {
    now - Duration::days(days as i64)
}

fn clamp_days(days: i32) -> i32 {
    days.clamp(1, 3650)
}

fn task_title_room(
    task_id: &str,
    tasks_by_id: &HashMap<String, (String, String)>,
) -> (Option<String>, Option<String>) {
    tasks_by_id
        .get(task_id)
        .map(|(t, r)| (Some(t.clone()), Some(r.clone())))
        .unwrap_or((None, None))
}

fn check_prompt_room(
    check_id: &str,
    checks_by_id: &HashMap<String, (String, String)>,
) -> (Option<String>, Option<String>) {
    checks_by_id
        .get(check_id)
        .map(|(p, r)| (Some(p.clone()), Some(r.clone())))
        .unwrap_or((None, None))
}

#[derive(Debug, Clone)]
pub struct MetricsResult {
    pub days: i32,
    pub range_from: String,
    pub range_to: String,
    pub tasks_done_total: i64,
    pub tasks_done_by_day: Vec<(String, i64)>,
    pub tasks_done_by_room: Vec<(String, i64)>,
    pub tasks_done_top: Vec<(String, Option<String>, Option<String>, i64)>,
    pub deals_total: i64,
    pub time_bucket_avg: Option<f64>,
    pub time_bucket_counts: Vec<(i32, i64)>,
    pub scans_total: i64,
    pub checks_no_total: i64,
    pub checks_no_by_room: Vec<(String, i64)>,
    pub checks_no_top: Vec<(String, Option<String>, Option<String>, i64)>,
}

pub fn compute_metrics(
    now: DateTime<Utc>,
    days: i32,
    tasks_by_id: &HashMap<String, (String, String)>,
    checks_by_id: &HashMap<String, (String, String)>,
    events: &[Value],
    top_n: usize,
) -> MetricsResult {
    let days = clamp_days(days);
    let start = days_from(now, days);

    let mut tasks_done_by_day: HashMap<String, i64> = HashMap::new();
    let mut tasks_done_by_task: HashMap<String, i64> = HashMap::new();
    let mut tasks_done_by_room: HashMap<String, i64> = HashMap::new();
    let mut time_bucket_counts: HashMap<i32, i64> = HashMap::new();
    let mut checks_no_by_room: HashMap<String, i64> = HashMap::new();
    let mut checks_no_by_check: HashMap<String, i64> = HashMap::new();
    let mut deals_total: i64 = 0;
    let mut scans_total: i64 = 0;

    for event in events {
        let ts_raw = match event.get("ts").and_then(|v| v.as_str()) {
            Some(s) => s,
            None => continue,
        };
        let ets = match parse_event_ts(ts_raw) {
            Some(dt) => dt,
            None => continue,
        };
        if ets < start {
            continue;
        }

        let etype = match event.get("type").and_then(|v| v.as_str()) {
            Some(t) => t,
            None => continue,
        };

        match etype {
            "task_done" => {
                let task_id = match event.get("task_id").and_then(|v| v.as_str()) {
                    Some(id) => id.to_string(),
                    None => continue,
                };
                *tasks_done_by_day.entry(utc_day_key(ets)).or_insert(0) += 1;
                *tasks_done_by_task.entry(task_id.clone()).or_insert(0) += 1;
                if let Some((_, room)) = tasks_by_id.get(&task_id) {
                    *tasks_done_by_room.entry(room.clone()).or_insert(0) += 1;
                }
            }
            "deal" => {
                deals_total += 1;
                if let Some(tm) = event.get("time_min").and_then(|v| v.as_i64()) {
                    if tm > 0 {
                        *time_bucket_counts.entry(tm as i32).or_insert(0) += 1;
                    }
                }
            }
            "scan_answer" => {
                scans_total += 1;
                if event.get("answer").and_then(|v| v.as_str()) != Some("no") {
                    continue;
                }
                let check_id = match event.get("check_id").and_then(|v| v.as_str()) {
                    Some(id) => id.to_string(),
                    None => continue,
                };
                *checks_no_by_check.entry(check_id.clone()).or_insert(0) += 1;
                let room = checks_by_id
                    .get(&check_id)
                    .map(|(_, r)| r.clone())
                    .or_else(|| {
                        event
                            .get("room")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
                    });
                if let Some(r) = room {
                    *checks_no_by_room.entry(r).or_insert(0) += 1;
                }
            }
            _ => {}
        }
    }

    // Fill zero-count days
    let mut tasks_done_by_day_vec: Vec<(String, i64)> = Vec::new();
    let mut cursor_dt = start;
    let end_day = now.date_naive();
    while cursor_dt.date_naive() <= end_day {
        let key = cursor_dt.format("%Y-%m-%d").to_string();
        let count = tasks_done_by_day.get(&key).copied().unwrap_or(0);
        tasks_done_by_day_vec.push((key, count));
        cursor_dt += Duration::days(1);
    }

    let mut tasks_done_by_room_vec: Vec<(String, i64)> = tasks_done_by_room.into_iter().collect();
    tasks_done_by_room_vec.sort_by_key(|b| std::cmp::Reverse(b.1));

    let mut tasks_done_by_task_vec: Vec<(String, i64)> = tasks_done_by_task.into_iter().collect();
    tasks_done_by_task_vec.sort_by_key(|b| std::cmp::Reverse(b.1));
    let top_n = top_n.min(tasks_done_by_task_vec.len());
    let tasks_done_top: Vec<(String, Option<String>, Option<String>, i64)> = tasks_done_by_task_vec
        [..top_n]
        .iter()
        .map(|(id, count)| {
            let (title, room) = task_title_room(id, tasks_by_id);
            (id.clone(), title, room, *count)
        })
        .collect();

    let tasks_done_total: i64 = tasks_done_by_day_vec.iter().map(|(_, c)| c).sum();

    let mut time_bucket_vec: Vec<(i32, i64)> = time_bucket_counts.into_iter().collect();
    time_bucket_vec.sort_by_key(|a| a.0);
    let time_bucket_avg = if !time_bucket_vec.is_empty() {
        let total: i64 = time_bucket_vec.iter().map(|(_, c)| c).sum();
        let weighted: f64 = time_bucket_vec
            .iter()
            .map(|(k, v)| *k as f64 * *v as f64)
            .sum();
        Some(weighted / total as f64)
    } else {
        None
    };

    let checks_no_total: i64 = checks_no_by_check.values().sum();

    let mut checks_no_by_room_vec: Vec<(String, i64)> = checks_no_by_room.into_iter().collect();
    checks_no_by_room_vec.sort_by_key(|b| std::cmp::Reverse(b.1));

    let mut checks_no_by_check_vec: Vec<(String, i64)> = checks_no_by_check.into_iter().collect();
    checks_no_by_check_vec.sort_by_key(|b| std::cmp::Reverse(b.1));
    let top_nc = top_n.min(checks_no_by_check_vec.len());
    let checks_no_top: Vec<(String, Option<String>, Option<String>, i64)> = checks_no_by_check_vec
        [..top_nc]
        .iter()
        .map(|(id, count)| {
            let (prompt, room) = check_prompt_room(id, checks_by_id);
            (id.clone(), prompt, room, *count)
        })
        .collect();

    MetricsResult {
        days,
        range_from: start.to_rfc3339(),
        range_to: now.to_rfc3339(),
        tasks_done_total,
        tasks_done_by_day: tasks_done_by_day_vec,
        tasks_done_by_room: tasks_done_by_room_vec,
        tasks_done_top,
        deals_total,
        time_bucket_avg,
        time_bucket_counts: time_bucket_vec,
        scans_total,
        checks_no_total,
        checks_no_by_room: checks_no_by_room_vec,
        checks_no_top,
    }
}

pub fn build_tasks_lookup(tasks: &[Task]) -> HashMap<String, (String, String)> {
    tasks
        .iter()
        .map(|t| (t.id.clone(), (t.title.clone(), t.room.clone())))
        .collect()
}

pub fn build_checks_lookup(checks: &[Check]) -> HashMap<String, (String, String)> {
    checks
        .iter()
        .map(|c| (c.id.clone(), (c.prompt.clone(), c.room.clone())))
        .collect()
}
