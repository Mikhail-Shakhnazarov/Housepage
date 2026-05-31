from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from .derive import DerivedTaskSignals, derive_task_signals, overdue_factor
from .models import Check, Task


@dataclass(frozen=True)
class DealParams:
    room: str
    energy: int
    time_min: int
    hand_size: int


@dataclass(frozen=True)
class Tunables:
    weight_overdue: float = 2.0
    weight_scan_boost: float = 3.0
    weight_room_bias: float = 0.35
    room_bias_gap_threshold: float = 0.75
    skip_recent_penalty: float = 0.5
    skip_cooldown_hours: float = 12.0
    scan_boost_window_hours: float = 48.0
    scan_boost_decay_hours: float = 48.0
    skip_window_days: int = 7


def _comfort_boost(task: Task) -> float:
    title = task.title.lower()
    if "garbage" in title or "toilet" in title or "sink" in title or "litter" in title:
        return 0.5
    if task.room in {"garbage", "cats"} and task.kind in {"clean", "tidy"}:
        return 0.35
    return 0.0


def _eligible(*, task: Task, params: DealParams, signals: DerivedTaskSignals, now: datetime, tunables: Tunables) -> bool:
    if task.effort > params.energy:
        return False
    if task.minutes_est > params.time_min:
        return False
    if signals.last_skip_ts is not None:
        age_hours = (now - signals.last_skip_ts).total_seconds() / 3600.0
        if age_hours < tunables.skip_cooldown_hours:
            return False
    return True


def deal_tasks(
    *,
    params: DealParams,
    now: datetime,
    tasks: list[Task],
    checks: list[Check],
    events: list[dict[str, Any]],
    exclude_task_ids: set[str] | None = None,
    tunables: Tunables | None = None,
) -> list[dict[str, Any]]:
    t = tunables or Tunables()
    exclude = exclude_task_ids or set()

    linked_check_ids_by_task: dict[str, set[str]] = {}
    for check in checks:
        for task_id in check.linked_task_ids:
            linked_check_ids_by_task.setdefault(task_id, set()).add(check.id)

    scored: list[dict[str, Any]] = []
    for task in tasks:
        if task.id in exclude:
            continue
        linked_checks = linked_check_ids_by_task.get(task.id, set())
        signals = derive_task_signals(
            now=now,
            task_id=task.id,
            room_context=params.room,
            linked_check_ids=linked_checks,
            events=events,
            scan_boost_window_hours=t.scan_boost_window_hours,
            scan_boost_decay_hours=t.scan_boost_decay_hours,
            skip_window_days=t.skip_window_days,
        )
        if not _eligible(task=task, params=params, signals=signals, now=now, tunables=t):
            continue

        overdue = overdue_factor(now=now, last_done_ts=signals.last_done_ts, frequency_days=task.frequency_days)
        score = 0.0
        score += t.weight_overdue * overdue
        score += t.weight_scan_boost * signals.scan_boost
        score += _comfort_boost(task)
        score -= t.skip_recent_penalty * float(signals.skip_count_recent)
        if task.room == params.room:
            score += t.weight_room_bias

        scored.append(
            {
                "task": task,
                "signals": signals,
                "score": score,
                "overdue": overdue,
            }
        )

    scored.sort(key=lambda x: x["score"], reverse=True)

    selected: list[dict[str, Any]] = []
    for item in scored:
        task: Task = item["task"]
        selected.append(
            {
                "task_id": task.id,
                "title": task.title,
                "room": task.room,
                "effort": task.effort,
                "minutes_est": task.minutes_est,
                "score": round(float(item["score"]), 4),
            }
        )
        if len(selected) >= params.hand_size:
            break

    if not selected:
        return []

    # Apply "room is context" bias: if the best non-room task beats the best room task by a large gap,
    # keep it; otherwise room tasks should dominate. This is implemented by demoting non-room tasks that
    # are close to the best room-matching score.
    best_room_score = max((x["score"] for x in scored if x["task"].room == params.room), default=None)
    if best_room_score is not None:
        def keep(task_view: dict[str, Any]) -> bool:
            if task_view["room"] == params.room:
                return True
            return (task_view["score"] - best_room_score) >= t.room_bias_gap_threshold

        filtered = [tv for tv in selected if keep(tv)]
        if filtered:
            selected = filtered + [tv for tv in selected if tv not in filtered]
            selected = selected[: params.hand_size]

    return selected
