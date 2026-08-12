from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import StrEnum
from typing import Iterable, Mapping


class Answer(StrEnum):
    YES = "yes"
    NO = "no"


class ActionKind(StrEnum):
    DONE = "done"
    SKIP = "skip"


@dataclass(frozen=True, slots=True)
class Check:
    id: str
    room: str
    prompt: str
    linked_task_ids: tuple[str, ...]
    trigger_answer: Answer | None = None


@dataclass(frozen=True, slots=True)
class Task:
    id: str
    title: str
    room: str
    kind: str
    effort: int
    minutes_est: int
    frequency_days: int | None = None


@dataclass(frozen=True, slots=True)
class Event:
    type: str
    ts: datetime
    event_id: str | None = None
    session_id: str | None = None
    device_id: str | None = None
    client_ts: datetime | None = None
    room: str | None = None
    task_id: str | None = None
    check_id: str | None = None
    answer: Answer | None = None
    energy: int | None = None
    time_min: int | None = None
    hand_size: int | None = None
    task_ids: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if self.ts.tzinfo is None:
            raise ValueError("event timestamps must be timezone-aware")
        if self.client_ts is not None and self.client_ts.tzinfo is None:
            raise ValueError("client timestamps must be timezone-aware")
        if self.energy is not None and not 1 <= self.energy <= 5:
            raise ValueError("event energy must be in 1..5")
        if self.time_min is not None and not 1 <= self.time_min <= 480:
            raise ValueError("event time_min must be in 1..480")
        if self.hand_size is not None and not 1 <= self.hand_size <= 20:
            raise ValueError("event hand_size must be in 1..20")


@dataclass(frozen=True, slots=True)
class DealRequest:
    room: str
    energy: int
    time_min: int
    hand_size: int = 3

    def __post_init__(self) -> None:
        if not 1 <= self.energy <= 5:
            raise ValueError("energy must be in 1..5")
        if not 1 <= self.time_min <= 480:
            raise ValueError("time_min must be in 1..480")
        if not 1 <= self.hand_size <= 20:
            raise ValueError("hand_size must be in 1..20")


@dataclass(frozen=True, slots=True)
class Tunables:
    version: str = "deal-v2"
    weight_overdue: float = 2.0
    weight_scan_boost: float = 3.0
    weight_room_bias: float = 0.35
    room_bias_gap_threshold: float = 0.75
    skip_recent_penalty: float = 0.5
    skip_cooldown_hours: float = 12.0
    scan_boost_window_hours: float = 48.0
    scan_boost_decay_hours: float = 48.0
    skip_window_days: int = 7


@dataclass(frozen=True, slots=True)
class TaskSignals:
    last_done_ts: datetime | None
    last_skip_ts: datetime | None
    skip_count_recent: int
    scan_boost: float


@dataclass(frozen=True, slots=True)
class DealItem:
    task_id: str
    title: str
    room: str
    effort: int
    minutes_est: int
    score: float
    reason_codes: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class Deal:
    algorithm_version: str
    request: DealRequest
    items: tuple[DealItem, ...]


def _comfort_boost(task: Task) -> float:
    title = task.title.casefold()
    if any(word in title for word in ("garbage", "toilet", "sink", "litter")):
        return 0.5
    if task.room in {"garbage", "cats"} and task.kind in {"clean", "tidy"}:
        return 0.35
    return 0.0


def _overdue_factor(now: datetime, last_done_ts: datetime | None, frequency_days: int | None) -> float:
    if frequency_days is None:
        return 0.0
    if frequency_days <= 0:
        raise ValueError("frequency_days must be positive")
    if last_done_ts is None:
        return 1.0
    age_days = (now - last_done_ts).total_seconds() / 86400.0
    return max(age_days / frequency_days, 0.0)


def derive_task_signals(
    *,
    now: datetime,
    task_id: str,
    room_context: str,
    linked_check_triggers: Mapping[str, Answer | None],
    events: Iterable[Event],
    tunables: Tunables,
) -> TaskSignals:
    last_done_ts: datetime | None = None
    last_skip_ts: datetime | None = None
    skip_count_recent = 0
    scan_boost = 0.0

    skip_cutoff = now - timedelta(days=tunables.skip_window_days)
    scan_cutoff = now - timedelta(hours=tunables.scan_boost_window_hours)

    for event in events:
        if event.ts > now:
            continue
        if event.type == "task_done" and event.task_id == task_id:
            if last_done_ts is None or event.ts > last_done_ts:
                last_done_ts = event.ts
        elif event.type == "task_skip" and event.task_id == task_id:
            if last_skip_ts is None or event.ts > last_skip_ts:
                last_skip_ts = event.ts
            if event.ts >= skip_cutoff:
                skip_count_recent += 1
        elif event.type == "scan_answer" and event.room == room_context and event.check_id:
            trigger = linked_check_triggers.get(event.check_id)
            if trigger is not None and event.answer == trigger and event.ts >= scan_cutoff:
                age_hours = (now - event.ts).total_seconds() / 3600.0
                decay = max(1.0 - (age_hours / tunables.scan_boost_decay_hours), 0.0)
                scan_boost += decay

    return TaskSignals(last_done_ts, last_skip_ts, skip_count_recent, scan_boost)


def deal_tasks(
    *,
    request: DealRequest,
    now: datetime,
    tasks: Iterable[Task],
    checks: Iterable[Check],
    events: Iterable[Event],
    exclude_task_ids: frozenset[str] = frozenset(),
    tunables: Tunables = Tunables(),
) -> Deal:
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")

    event_list = tuple(events)
    linked_checks_by_task: dict[str, dict[str, Answer | None]] = {}
    for check in checks:
        for task_id in check.linked_task_ids:
            linked_checks_by_task.setdefault(task_id, {})[check.id] = check.trigger_answer

    scored: list[DealItem] = []
    for task in tasks:
        if task.id in exclude_task_ids:
            continue
        signals = derive_task_signals(
            now=now,
            task_id=task.id,
            room_context=request.room,
            linked_check_triggers=linked_checks_by_task.get(task.id, {}),
            events=event_list,
            tunables=tunables,
        )
        if task.effort > request.energy or task.minutes_est > request.time_min:
            continue
        if signals.last_skip_ts is not None:
            age_hours = (now - signals.last_skip_ts).total_seconds() / 3600.0
            if age_hours < tunables.skip_cooldown_hours:
                continue

        overdue = _overdue_factor(now, signals.last_done_ts, task.frequency_days)
        comfort = _comfort_boost(task)
        room_bias = tunables.weight_room_bias if task.room == request.room else 0.0
        score = (
            tunables.weight_overdue * overdue
            + tunables.weight_scan_boost * signals.scan_boost
            + comfort
            + room_bias
            - tunables.skip_recent_penalty * signals.skip_count_recent
        )
        reasons: list[str] = []
        if overdue > 0:
            reasons.append("overdue")
        if signals.scan_boost > 0:
            reasons.append("scan")
        if room_bias > 0:
            reasons.append("room")
        if comfort > 0:
            reasons.append("comfort")
        if signals.skip_count_recent:
            reasons.append("recent-skips")

        scored.append(
            DealItem(
                task_id=task.id,
                title=task.title,
                room=task.room,
                effort=task.effort,
                minutes_est=task.minutes_est,
                score=round(score, 4),
                reason_codes=tuple(reasons),
            )
        )

    scored.sort(key=lambda item: (-item.score, item.title.casefold(), item.task_id))
    selected = scored[: request.hand_size]

    room_candidates = [item for item in scored if item.room == request.room]
    if selected and room_candidates:
        best_room_score = room_candidates[0].score
        close_room_ids = {
            item.task_id
            for item in room_candidates
            if item.score >= best_room_score - tunables.room_bias_gap_threshold
        }
        selected.sort(
            key=lambda item: (
                0 if item.task_id in close_room_ids else 1,
                -item.score,
                item.title.casefold(),
                item.task_id,
            )
        )

    return Deal(algorithm_version=tunables.version, request=request, items=tuple(selected))


def utc(year: int, month: int, day: int, hour: int = 0) -> datetime:
    return datetime(year, month, day, hour, tzinfo=timezone.utc)
