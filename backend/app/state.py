from __future__ import annotations

from datetime import datetime
from typing import Any

from .deal import Tunables, _comfort_boost
from .derive import derive_task_signals, overdue_factor
from .models import Check, Task


def compute_state(
    *,
    now: datetime,
    room: str,
    tasks: list[Task],
    checks: list[Check],
    events: list[dict[str, Any]],
    tunables: Tunables | None = None,
) -> list[dict[str, Any]]:
    t = tunables or Tunables()

    linked_check_ids_by_task: dict[str, set[str]] = {}
    for check in checks:
        for task_id in check.linked_task_ids:
            linked_check_ids_by_task.setdefault(task_id, set()).add(check.id)

    rows: list[dict[str, Any]] = []
    for task in tasks:
        linked_checks = linked_check_ids_by_task.get(task.id, set())
        signals = derive_task_signals(
            now=now,
            task_id=task.id,
            room_context=room,
            linked_check_ids=linked_checks,
            events=events,
            scan_boost_window_hours=t.scan_boost_window_hours,
            scan_boost_decay_hours=t.scan_boost_decay_hours,
            skip_window_days=t.skip_window_days,
        )
        overdue = overdue_factor(now=now, last_done_ts=signals.last_done_ts, frequency_days=task.frequency_days)
        comfort = _comfort_boost(task)
        room_bias = t.weight_room_bias if task.room == room else 0.0
        score = (
            t.weight_overdue * overdue
            + t.weight_scan_boost * signals.scan_boost
            + comfort
            - t.skip_recent_penalty * float(signals.skip_count_recent)
            + room_bias
        )
        rows.append(
            {
                "task_id": task.id,
                "title": task.title,
                "room": task.room,
                "effort": task.effort,
                "minutes_est": task.minutes_est,
                "frequency_days": task.frequency_days,
                "score": round(float(score), 4),
                "overdue": round(float(overdue), 4),
                "scan_boost": round(float(signals.scan_boost), 4),
                "skip_count_recent": signals.skip_count_recent,
                "last_done_ts": signals.last_done_ts.isoformat() if signals.last_done_ts else None,
                "last_skip_ts": signals.last_skip_ts.isoformat() if signals.last_skip_ts else None,
            }
        )

    rows.sort(key=lambda r: r["score"], reverse=True)
    return rows

