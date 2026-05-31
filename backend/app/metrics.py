from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from .derive import parse_iso


def _utc_day_key(ts: datetime) -> str:
    return ts.astimezone(timezone.utc).date().isoformat()


def _safe_parse_event_ts(event: dict[str, Any]) -> datetime | None:
    ts_raw = event.get("ts")
    if not isinstance(ts_raw, str):
        return None
    try:
        return parse_iso(ts_raw)
    except ValueError:
        return None


@dataclass(frozen=True)
class MetricsResult:
    days: int
    range_from: str
    range_to: str
    tasks_done_total: int
    tasks_done_by_day: list[dict[str, Any]]
    tasks_done_by_room: list[dict[str, Any]]
    tasks_done_top: list[dict[str, Any]]
    deals_total: int
    time_bucket_avg: float | None
    time_bucket_counts: list[dict[str, Any]]
    scans_total: int
    checks_no_total: int
    checks_no_by_room: list[dict[str, Any]]
    checks_no_top: list[dict[str, Any]]

    def to_dict(self) -> dict[str, Any]:
        return {
            "days": self.days,
            "range": {"from": self.range_from, "to": self.range_to},
            "tasks_done_total": self.tasks_done_total,
            "tasks_done_by_day": self.tasks_done_by_day,
            "tasks_done_by_room": self.tasks_done_by_room,
            "tasks_done_top": self.tasks_done_top,
            "deals_total": self.deals_total,
            "time_bucket_avg": self.time_bucket_avg,
            "time_bucket_counts": self.time_bucket_counts,
            "scans_total": self.scans_total,
            "checks_no_total": self.checks_no_total,
            "checks_no_by_room": self.checks_no_by_room,
            "checks_no_top": self.checks_no_top,
        }


def compute_metrics(
    *,
    now: datetime,
    days: int,
    tasks_by_id: dict[str, dict[str, Any]],
    checks_by_id: dict[str, dict[str, Any]],
    events: list[dict[str, Any]],
    top_n: int = 12,
) -> MetricsResult:
    days = max(1, min(int(days), 3650))
    start = now.astimezone(timezone.utc) - timedelta(days=days)

    tasks_done_by_day_counter: Counter[str] = Counter()
    tasks_done_by_task: Counter[str] = Counter()
    tasks_done_by_room: Counter[str] = Counter()

    time_bucket_counts: Counter[int] = Counter()

    scans_total = 0
    checks_no_by_room: Counter[str] = Counter()
    checks_no_by_check: Counter[str] = Counter()

    deals_total = 0

    for event in events:
        ets = _safe_parse_event_ts(event)
        if ets is None:
            continue
        if ets.astimezone(timezone.utc) < start:
            continue

        etype = event.get("type")

        if etype == "task_done":
            task_id = event.get("task_id")
            if not isinstance(task_id, str):
                continue
            tasks_done_by_day_counter[_utc_day_key(ets)] += 1
            tasks_done_by_task[task_id] += 1
            room = (tasks_by_id.get(task_id) or {}).get("room")
            if isinstance(room, str):
                tasks_done_by_room[room] += 1

        if etype == "deal":
            deals_total += 1
            time_min = event.get("time_min")
            if isinstance(time_min, int) and time_min > 0:
                time_bucket_counts[time_min] += 1

        if etype == "scan_answer":
            scans_total += 1
            if event.get("answer") != "no":
                continue
            check_id = event.get("check_id")
            if not isinstance(check_id, str):
                continue
            checks_no_by_check[check_id] += 1
            room = (checks_by_id.get(check_id) or {}).get("room") or event.get("room")
            if isinstance(room, str):
                checks_no_by_room[room] += 1

    # Fill missing days with zeros for stable UI.
    tasks_done_by_day: list[dict[str, Any]] = []
    day_cursor = start.astimezone(timezone.utc).date()
    end_day = now.astimezone(timezone.utc).date()
    while day_cursor <= end_day:
        key = day_cursor.isoformat()
        tasks_done_by_day.append({"day": key, "count": int(tasks_done_by_day_counter.get(key, 0))})
        day_cursor = day_cursor + timedelta(days=1)

    tasks_done_by_room_list = [
        {"room": room, "count": int(count)} for room, count in tasks_done_by_room.most_common()
    ]

    tasks_done_top = []
    for task_id, count in tasks_done_by_task.most_common(top_n):
        t = tasks_by_id.get(task_id) or {}
        tasks_done_top.append(
            {
                "task_id": task_id,
                "title": t.get("title") if isinstance(t.get("title"), str) else None,
                "room": t.get("room") if isinstance(t.get("room"), str) else None,
                "count": int(count),
            }
        )

    time_bucket_counts_list = [{"time_min": int(k), "count": int(v)} for k, v in sorted(time_bucket_counts.items())]
    if time_bucket_counts:
        total = sum(time_bucket_counts.values())
        weighted = sum(k * v for k, v in time_bucket_counts.items())
        time_bucket_avg = float(weighted) / float(total)
    else:
        time_bucket_avg = None

    checks_no_total = int(sum(checks_no_by_check.values()))
    checks_no_by_room_list = [{"room": room, "count": int(count)} for room, count in checks_no_by_room.most_common()]
    checks_no_top = []
    for check_id, count in checks_no_by_check.most_common(top_n):
        c = checks_by_id.get(check_id) or {}
        checks_no_top.append(
            {
                "check_id": check_id,
                "prompt": c.get("prompt") if isinstance(c.get("prompt"), str) else None,
                "room": c.get("room") if isinstance(c.get("room"), str) else None,
                "count": int(count),
            }
        )

    return MetricsResult(
        days=days,
        range_from=start.astimezone(timezone.utc).isoformat(),
        range_to=now.astimezone(timezone.utc).isoformat(),
        tasks_done_total=int(sum(tasks_done_by_day_counter.values())),
        tasks_done_by_day=tasks_done_by_day,
        tasks_done_by_room=tasks_done_by_room_list,
        tasks_done_top=tasks_done_top,
        deals_total=int(deals_total),
        time_bucket_avg=time_bucket_avg,
        time_bucket_counts=time_bucket_counts_list,
        scans_total=int(scans_total),
        checks_no_total=checks_no_total,
        checks_no_by_room=checks_no_by_room_list,
        checks_no_top=checks_no_top,
    )

