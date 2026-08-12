from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable, Mapping
from uuid import uuid4

from .core import Answer, Deal, DealRequest, Event, deal_tasks
from .storage import SQLiteHouseholdStore


class RitualError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class ScanSession:
    id: str
    room: str
    check_ids: tuple[str, ...]
    started_at: datetime


@dataclass(frozen=True, slots=True)
class RecordedDeal:
    session_id: str
    event_id: str
    deal: Deal


@dataclass(frozen=True, slots=True)
class RecordedAction:
    session_id: str
    event_id: str
    task_id: str
    action: str
    at: datetime


class RitualService:
    def __init__(
        self,
        store: SQLiteHouseholdStore,
        *,
        now: Callable[[], datetime] | None = None,
        new_id: Callable[[str], str] | None = None,
        device_id: str = "local",
    ) -> None:
        self.store = store
        self._now = now or (lambda: datetime.now(timezone.utc))
        self._new_id = new_id or (lambda prefix: f"{prefix}:{uuid4()}")
        self.device_id = device_id

    def _time(self) -> datetime:
        value = self._now()
        if value.tzinfo is None:
            raise RuntimeError("RitualService clock must return timezone-aware datetimes")
        return value

    def start_scan(self, room: str) -> ScanSession:
        if room not in {item.id for item in self.store.rooms()}:
            raise RitualError(f"unknown room: {room}")
        checks = tuple(check for check in self.store.checks() if check.room == room)
        if not checks:
            raise RitualError(f"room has no scan checks: {room}")
        at = self._time()
        session_id = self._new_id("session")
        event_id = self._new_id("event")
        self.store.append_event(
            Event(
                type="scan_started",
                ts=at,
                event_id=event_id,
                session_id=session_id,
                device_id=self.device_id,
                client_ts=at,
                room=room,
            )
        )
        return ScanSession(
            id=session_id,
            room=room,
            check_ids=tuple(check.id for check in checks),
            started_at=at,
        )

    def submit_scan(
        self,
        session: ScanSession,
        answers: Mapping[str, Answer],
    ) -> None:
        expected = set(session.check_ids)
        supplied = set(answers)
        if supplied != expected:
            missing = sorted(expected - supplied)
            extra = sorted(supplied - expected)
            raise RitualError(
                f"scan answers must cover exactly the session checks; missing={missing}, extra={extra}"
            )
        at = self._time()
        for check_id in session.check_ids:
            self.store.append_event(
                Event(
                    type="scan_answer",
                    ts=at,
                    event_id=self._new_id("event"),
                    session_id=session.id,
                    device_id=self.device_id,
                    client_ts=at,
                    room=session.room,
                    check_id=check_id,
                    answer=answers[check_id],
                )
            )
        self.store.append_event(
            Event(
                type="scan_completed",
                ts=at,
                event_id=self._new_id("event"),
                session_id=session.id,
                device_id=self.device_id,
                client_ts=at,
                room=session.room,
            )
        )

    def deal(
        self,
        session: ScanSession,
        *,
        energy: int,
        time_min: int,
        hand_size: int = 3,
    ) -> RecordedDeal:
        at = self._time()
        request = DealRequest(
            room=session.room,
            energy=energy,
            time_min=time_min,
            hand_size=hand_size,
        )
        deal = deal_tasks(
            request=request,
            now=at,
            tasks=self.store.tasks(),
            checks=self.store.checks(),
            events=self.store.events(),
        )
        event_id = self._new_id("event")
        self.store.append_event(
            Event(
                type="deal",
                ts=at,
                event_id=event_id,
                session_id=session.id,
                device_id=self.device_id,
                client_ts=at,
                room=session.room,
                energy=energy,
                time_min=time_min,
                hand_size=hand_size,
                task_ids=tuple(item.task_id for item in deal.items),
            )
        )
        return RecordedDeal(session.id, event_id, deal)

    def record_action(
        self,
        session: ScanSession,
        *,
        task_id: str,
        action: str,
    ) -> RecordedAction:
        if action not in {"done", "skip"}:
            raise RitualError(f"unsupported action: {action}")
        if task_id not in {task.id for task in self.store.tasks()}:
            raise RitualError(f"unknown task: {task_id}")
        prior_deals = [
            event
            for event in self.store.events()
            if event.type == "deal" and event.session_id == session.id
        ]
        if not prior_deals:
            raise RitualError("cannot act before a hand has been dealt")
        latest_deal = prior_deals[-1]
        if task_id not in latest_deal.task_ids:
            raise RitualError("task was not in the latest dealt hand")
        existing = [
            event
            for event in self.store.events()
            if event.session_id == session.id
            and event.task_id == task_id
            and event.type in {"task_done", "task_skip"}
        ]
        if existing:
            raise RitualError("task already has an action in this session")

        at = self._time()
        event_id = self._new_id("event")
        self.store.append_event(
            Event(
                type="task_done" if action == "done" else "task_skip",
                ts=at,
                event_id=event_id,
                session_id=session.id,
                device_id=self.device_id,
                client_ts=at,
                room=session.room,
                task_id=task_id,
            )
        )
        return RecordedAction(session.id, event_id, task_id, action, at)
