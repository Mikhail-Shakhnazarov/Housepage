use chrono::{DateTime, Duration, Utc};
use serde_json::Value;
use std::collections::HashSet;
use std::path::Path;

pub fn parse_event_ts(ts: &str) -> Option<DateTime<Utc>> {
    // Accept RFC 3339 with or without sub-second precision, with Z or +00:00 offset.
    if let Ok(dt) = DateTime::parse_from_rfc3339(ts) {
        return Some(dt.with_timezone(&Utc));
    }
    // Fallback: allow naive-ish ISO strings by assuming UTC.
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(ts, "%Y-%m-%dT%H:%M:%S%.f") {
        return Some(dt.and_utc());
    }
    None
}

pub fn read_events(path: &Path) -> Vec<Value> {
    if !path.exists() {
        return Vec::new();
    }
    let content = match std::fs::read_to_string(path) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };
    content
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| serde_json::from_str(line).ok())
        .collect()
}

#[derive(Debug, Clone)]
pub struct DerivedTaskSignals {
    pub last_done_ts: Option<DateTime<Utc>>,
    pub last_skip_ts: Option<DateTime<Utc>>,
    pub skip_count_recent: i32,
    pub scan_boost: f64,
}

#[allow(clippy::too_many_arguments)]
pub fn derive_task_signals(
    now: DateTime<Utc>,
    task_id: &str,
    room_context: &str,
    linked_check_ids: &HashSet<String>,
    events: &[Value],
    scan_boost_window_hours: f64,
    scan_boost_decay_hours: f64,
    skip_window_days: i32,
) -> DerivedTaskSignals {
    let mut last_done_ts: Option<DateTime<Utc>> = None;
    let mut last_skip_ts: Option<DateTime<Utc>> = None;
    let mut skip_count_recent = 0;
    let mut scan_boost = 0.0;

    let skip_cutoff = now - Duration::days(skip_window_days as i64);
    let scan_cutoff = now - Duration::minutes((scan_boost_window_hours * 60.0) as i64);

    for event in events {
        let etype = event.get("type").and_then(|v| v.as_str());
        let ets_raw = event.get("ts").and_then(|v| v.as_str());

        let ets = match ets_raw {
            Some(ts) => match ts.parse::<DateTime<Utc>>() {
                Ok(dt) => dt,
                Err(_) => continue,
            },
            None => continue,
        };

        match etype {
            Some("task_done") if event.get("task_id").and_then(|v| v.as_str()) == Some(task_id)
                && last_done_ts.is_none_or(|prev| ets > prev) =>
            {
                last_done_ts = Some(ets);
            }
            Some("task_skip") if event.get("task_id").and_then(|v| v.as_str()) == Some(task_id) => {
                if last_skip_ts.is_none_or(|prev| ets > prev) {
                    last_skip_ts = Some(ets);
                }
                if ets >= skip_cutoff {
                    skip_count_recent += 1;
                }
            }
            Some("scan_answer") => {
                if event.get("room").and_then(|v| v.as_str()) != Some(room_context) {
                    continue;
                }
                if event.get("answer").and_then(|v| v.as_str()) != Some("no") {
                    continue;
                }
                let check_id = match event.get("check_id").and_then(|v| v.as_str()) {
                    Some(id) => id,
                    None => continue,
                };
                if !linked_check_ids.contains(check_id) {
                    continue;
                }
                if ets < scan_cutoff {
                    continue;
                }

                let age_hours = (now - ets).num_seconds() as f64 / 3600.0;
                let decay = (1.0 - (age_hours / scan_boost_decay_hours)).max(0.0);
                scan_boost += decay;
            }
            _ => {}
        }
    }

    DerivedTaskSignals {
        last_done_ts,
        last_skip_ts,
        skip_count_recent,
        scan_boost,
    }
}

pub fn overdue_factor(
    now: DateTime<Utc>,
    last_done_ts: Option<DateTime<Utc>>,
    frequency_days: Option<i32>,
) -> f64 {
    match frequency_days {
        None => 0.0,
        Some(freq) => {
            let last_ts = match last_done_ts {
                None => return 1.0,
                Some(ts) => ts,
            };
            let age_days = (now - last_ts).num_seconds() as f64 / 86400.0;
            (age_days / freq as f64).max(0.0)
        }
    }
}
