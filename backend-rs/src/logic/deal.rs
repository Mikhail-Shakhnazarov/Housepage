use chrono::{DateTime, Utc};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

use crate::logic::derive::{derive_task_signals, overdue_factor};
use crate::models::{Check, DealTaskView, Task};

#[derive(Debug)]
pub struct DealParams {
    pub room: String,
    pub energy: i32,
    pub time_min: i32,
    pub hand_size: i32,
}

#[derive(Debug)]
pub struct Tunables {
    pub weight_overdue: f64,
    pub weight_scan_boost: f64,
    pub weight_room_bias: f64,
    pub room_bias_gap_threshold: f64,
    pub skip_recent_penalty: f64,
    pub skip_cooldown_hours: f64,
    pub scan_boost_window_hours: f64,
    pub scan_boost_decay_hours: f64,
    pub skip_window_days: i32,
}

impl Default for Tunables {
    fn default() -> Self {
        Self {
            weight_overdue: 2.0,
            weight_scan_boost: 3.0,
            weight_room_bias: 0.35,
            room_bias_gap_threshold: 0.75,
            skip_recent_penalty: 0.5,
            skip_cooldown_hours: 12.0,
            scan_boost_window_hours: 48.0,
            scan_boost_decay_hours: 48.0,
            skip_window_days: 7,
        }
    }
}

fn comfort_boost(task: &Task) -> f64 {
    let title = task.title.to_lowercase();
    if title.contains("garbage")
        || title.contains("toilet")
        || title.contains("sink")
        || title.contains("litter")
    {
        return 0.5;
    }
    if (task.room == "garbage" || task.room == "cats")
        && (task.kind == "clean" || task.kind == "tidy")
    {
        return 0.35;
    }
    0.0
}

fn is_eligible(
    task: &Task,
    params: &DealParams,
    last_skip_ts: Option<DateTime<Utc>>,
    now: DateTime<Utc>,
    tunables: &Tunables,
) -> bool {
    if task.effort > params.energy {
        return false;
    }
    if task.minutes_est > params.time_min {
        return false;
    }
    if let Some(ts) = last_skip_ts {
        let age_hours = (now - ts).num_seconds() as f64 / 3600.0;
        if age_hours < tunables.skip_cooldown_hours {
            return false;
        }
    }
    true
}

pub fn deal_tasks(
    params: &DealParams,
    now: DateTime<Utc>,
    tasks: &[Task],
    checks: &[Check],
    events: &[Value],
    exclude_task_ids: &HashSet<String>,
    tunables: Option<Tunables>,
) -> Vec<DealTaskView> {
    let t = tunables.unwrap_or_default();

    let mut linked_check_ids_by_task: HashMap<String, HashSet<String>> = HashMap::new();
    for check in checks {
        for task_id in &check.linked_task_ids {
            linked_check_ids_by_task
                .entry(task_id.clone())
                .or_default()
                .insert(check.id.clone());
        }
    }

    struct Scored {
        task: Task,
        score: f64,
    }

    let mut scored: Vec<Scored> = Vec::new();
    for task in tasks {
        if exclude_task_ids.contains(&task.id) {
            continue;
        }

        let linked_checks = linked_check_ids_by_task
            .get(&task.id)
            .cloned()
            .unwrap_or_default();
        let signals = derive_task_signals(
            now,
            &task.id,
            &params.room,
            &linked_checks,
            events,
            t.scan_boost_window_hours,
            t.scan_boost_decay_hours,
            t.skip_window_days,
        );

        if !is_eligible(task, params, signals.last_skip_ts, now, &t) {
            continue;
        }

        let overdue = overdue_factor(now, signals.last_done_ts, task.frequency_days);
        let mut score = 0.0;
        score += t.weight_overdue * overdue;
        score += t.weight_scan_boost * signals.scan_boost;
        score += comfort_boost(task);
        score -= t.skip_recent_penalty * signals.skip_count_recent as f64;

        if task.room == params.room {
            score += t.weight_room_bias;
        }

        scored.push(Scored {
            task: task.clone(),
            score,
        });
    }

    scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());

    let mut selected: Vec<DealTaskView> = Vec::new();
    for item in &scored {
        selected.push(DealTaskView {
            task_id: item.task.id.clone(),
            title: item.task.title.clone(),
            room: item.task.room.clone(),
            effort: item.task.effort,
            minutes_est: item.task.minutes_est,
            score: (item.score * 10000.0).round() / 10000.0,
        });
        if selected.len() >= params.hand_size as usize {
            break;
        }
    }

    if selected.is_empty() {
        return Vec::new();
    }

    // Apply room bias: demote non-room tasks if a room task is "close enough"
    let best_room_score = scored
        .iter()
        .filter(|x| x.task.room == params.room)
        .map(|x| x.score)
        .next();

    if let Some(room_score) = best_room_score {
        let mut filtered: Vec<DealTaskView> = selected
            .iter()
            .filter(|tv| {
                if tv.room == params.room {
                    return true;
                }
                (tv.score - room_score) >= t.room_bias_gap_threshold
            })
            .cloned()
            .collect();

        if !filtered.is_empty() {
            let mut others: Vec<DealTaskView> = selected
                .iter()
                .filter(|tv| !filtered.iter().any(|f| f.task_id == tv.task_id))
                .cloned()
                .collect();
            filtered.append(&mut others);
            filtered.truncate(params.hand_size as usize);
            selected = filtered;
        }
    }

    selected
}
