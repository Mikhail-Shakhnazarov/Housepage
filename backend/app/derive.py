from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def parse_iso(ts: str) -> datetime:
    # Accept ISO 8601 with timezone; fall back to UTC naive as UTC.
    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def read_events(events_path: Path) -> list[dict[str, Any]]:
    if not events_path.exists():
        return []
    events: list[dict[str, Any]] = []
    with events_path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                # v0 stance: ignore malformed lines rather than fail the whole app.
                continue
            if isinstance(obj, dict):
                events.append(obj)
    return events


@dataclass(frozen=True)
class DerivedTaskSignals:
    last_done_ts: datetime | None
    last_skip_ts: datetime | None
    skip_count_recent: int
    scan_boost: float


def derive_task_signals(
    *,
    now: datetime,
    task_id: str,
    room_context: str,
    linked_check_ids: set[str],
    events: list[dict[str, Any]],
    scan_boost_window_hours: float = 48.0,
    scan_boost_decay_hours: float = 48.0,
    skip_window_days: int = 7,
) -> DerivedTaskSignals:
    last_done_ts: datetime | None = None
    last_skip_ts: datetime | None = None
    skip_count_recent = 0
    scan_boost = 0.0

    skip_cutoff = now.timestamp() - (skip_window_days * 86400)
    scan_cutoff = now.timestamp() - (scan_boost_window_hours * 3600)

    for event in events:
        etype = event.get("type")
        ets_raw = event.get("ts")
        if not isinstance(ets_raw, str):
            continue
        try:
            ets = parse_iso(ets_raw)
        except ValueError:
            continue

        if etype == "task_done" and event.get("task_id") == task_id:
            if last_done_ts is None or ets > last_done_ts:
                last_done_ts = ets

        if etype == "task_skip" and event.get("task_id") == task_id:
            if last_skip_ts is None or ets > last_skip_ts:
                last_skip_ts = ets
            if ets.timestamp() >= skip_cutoff:
                skip_count_recent += 1

        if etype == "scan_answer":
            if event.get("room") != room_context:
                continue
            if event.get("answer") != "no":
                continue
            check_id = event.get("check_id")
            if not isinstance(check_id, str) or check_id not in linked_check_ids:
                continue
            if ets.timestamp() < scan_cutoff:
                continue
            age_hours = max(0.0, (now - ets).total_seconds() / 3600.0)
            decay = max(0.0, 1.0 - (age_hours / scan_boost_decay_hours))
            scan_boost += decay

    return DerivedTaskSignals(
        last_done_ts=last_done_ts,
        last_skip_ts=last_skip_ts,
        skip_count_recent=skip_count_recent,
        scan_boost=scan_boost,
    )


def overdue_factor(*, now: datetime, last_done_ts: datetime | None, frequency_days: int | None) -> float:
    if not frequency_days:
        return 0.0
    if last_done_ts is None:
        return 1.0
    age_days = (now - last_done_ts).total_seconds() / 86400.0
    return max(0.0, age_days / float(frequency_days))
