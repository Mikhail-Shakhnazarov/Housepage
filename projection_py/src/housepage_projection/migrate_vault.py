from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import json
from pathlib import Path
from typing import Any

from .core import Answer, Check, Event, Task
from .storage import RoomDefinition, SQLiteHouseholdStore


@dataclass(frozen=True, slots=True)
class MigrationIssue:
    code: str
    entity_kind: str
    entity_id: str
    message: str
    blocks_semantic_admission: bool


@dataclass(frozen=True, slots=True)
class VaultDefaults:
    hand_size: int
    scan_first: bool
    time_buckets_min: tuple[int, ...]
    energy_scale: str


@dataclass(frozen=True, slots=True)
class VaultMigration:
    rooms: tuple[RoomDefinition, ...]
    tasks: tuple[Task, ...]
    checks: tuple[Check, ...]
    events: tuple[Event, ...]
    defaults: VaultDefaults
    issues: tuple[MigrationIssue, ...]

    @property
    def unresolved_check_ids(self) -> tuple[str, ...]:
        return tuple(
            issue.entity_id
            for issue in self.issues
            if issue.code == "check_trigger_unresolved"
        )


def _datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    result = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError(f"legacy timestamp is not timezone-aware: {value!r}")
    return result


def parse_vault_documents(
    *,
    settings_text: str,
    tasks_text: str,
    checks_text: str,
    events_text: str,
) -> VaultMigration:
    settings_doc = json.loads(settings_text)
    tasks_doc = json.loads(tasks_text)
    checks_doc = json.loads(checks_text)

    for name, document in (
        ("settings", settings_doc),
        ("tasks", tasks_doc),
        ("checks", checks_doc),
    ):
        if int(document.get("schema_version", 1)) != 1:
            raise ValueError(f"unsupported legacy {name} schema")

    defaults_raw = settings_doc.get("defaults", {})
    defaults = VaultDefaults(
        hand_size=int(defaults_raw.get("hand_size", 3)),
        scan_first=bool(defaults_raw.get("scan_first", True)),
        time_buckets_min=tuple(int(v) for v in defaults_raw.get("time_buckets_min", (5, 10, 20, 45, 90))),
        energy_scale=str(defaults_raw.get("energy_scale", "1-5")),
    )

    rooms = tuple(
        RoomDefinition(id=str(item["id"]), name=str(item.get("label", item["id"])), sort_order=index)
        for index, item in enumerate(settings_doc.get("rooms", []))
    )
    room_ids = {room.id for room in rooms}

    tasks = tuple(
        Task(
            id=str(item["id"]),
            title=str(item["title"]),
            room=str(item["room"]),
            kind=str(item["kind"]),
            effort=int(item["effort"]),
            minutes_est=int(item["minutes_est"]),
            frequency_days=int(item["frequency_days"])
            if item.get("frequency_days") is not None
            else None,
        )
        for item in tasks_doc.get("tasks", [])
    )
    task_ids = {task.id for task in tasks}

    issues: list[MigrationIssue] = []
    for task in tasks:
        if task.room not in room_ids:
            issues.append(
                MigrationIssue(
                    "unknown_task_room",
                    "task",
                    task.id,
                    f"task references room {task.room!r}, absent from legacy settings",
                    True,
                )
            )

    checks: list[Check] = []
    for item in checks_doc.get("checks", []):
        check_id = str(item["id"])
        linked_task_ids = tuple(str(value) for value in item.get("linked_task_ids", []))
        checks.append(
            Check(
                id=check_id,
                room=str(item["room"]),
                prompt=str(item["prompt"]),
                linked_task_ids=linked_task_ids,
                trigger_answer=None,
            )
        )
        issues.append(
            MigrationIssue(
                "check_trigger_unresolved",
                "check",
                check_id,
                "legacy schema does not state whether YES or NO should boost linked tasks",
                True,
            )
        )
        for task_id in linked_task_ids:
            if task_id not in task_ids:
                issues.append(
                    MigrationIssue(
                        "unknown_linked_task",
                        "check",
                        check_id,
                        f"check references missing task {task_id}",
                        True,
                    )
                )
        if str(item["room"]) not in room_ids:
            issues.append(
                MigrationIssue(
                    "unknown_check_room",
                    "check",
                    check_id,
                    f"check references room {item['room']!r}, absent from legacy settings",
                    True,
                )
            )

    events: list[Event] = []
    seen_event_ids: set[str] = set()
    for line_number, raw_line in enumerate(events_text.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue
        item = json.loads(line)
        if int(item.get("schema_version", 1)) != 1:
            raise ValueError(f"unsupported event schema on line {line_number}")
        event_id = str(item["event_id"]) if item.get("event_id") is not None else None
        if event_id is not None:
            if event_id in seen_event_ids:
                issues.append(
                    MigrationIssue(
                        "duplicate_event_id",
                        "event",
                        event_id,
                        f"duplicate legacy event id at line {line_number}",
                        True,
                    )
                )
            seen_event_ids.add(event_id)
        event = Event(
            type=str(item["type"]),
            ts=_datetime(item["ts"]),  # type: ignore[arg-type]
            event_id=event_id,
            session_id=str(item["session_id"])
            if item.get("session_id") is not None
            else None,
            device_id=str(item["device_id"]) if item.get("device_id") is not None else None,
            client_ts=_datetime(item.get("client_ts")),
            room=str(item["room"]) if item.get("room") is not None else None,
            task_id=str(item["task_id"]) if item.get("task_id") is not None else None,
            check_id=str(item["check_id"]) if item.get("check_id") is not None else None,
            answer=Answer(str(item["answer"])) if item.get("answer") is not None else None,
            energy=int(item["energy"]) if item.get("energy") is not None else None,
            time_min=int(item["time_min"]) if item.get("time_min") is not None else None,
            hand_size=int(item["hand_size"]) if item.get("hand_size") is not None else None,
            task_ids=tuple(str(value) for value in item.get("task_ids", [])),
        )
        events.append(event)

        if event.task_id is not None and event.task_id not in task_ids:
            issues.append(
                MigrationIssue(
                    "event_unknown_task",
                    "event",
                    event.event_id or f"line:{line_number}",
                    f"event references missing task {event.task_id}",
                    False,
                )
            )
        if event.check_id is not None and event.check_id not in {check.id for check in checks}:
            issues.append(
                MigrationIssue(
                    "event_unknown_check",
                    "event",
                    event.event_id or f"line:{line_number}",
                    f"event references missing check {event.check_id}",
                    False,
                )
            )

    return VaultMigration(
        rooms=rooms,
        tasks=tasks,
        checks=tuple(checks),
        events=tuple(events),
        defaults=defaults,
        issues=tuple(issues),
    )


def load_vault(path: str | Path) -> VaultMigration:
    root = Path(path)
    return parse_vault_documents(
        settings_text=(root / "settings.json").read_text(encoding="utf-8"),
        tasks_text=(root / "tasks.json").read_text(encoding="utf-8"),
        checks_text=(root / "checks.json").read_text(encoding="utf-8"),
        events_text=(root / "events.ndjson").read_text(encoding="utf-8"),
    )


def apply_vault_migration(store: SQLiteHouseholdStore, migration: VaultMigration) -> None:
    """Load legacy state without claiming unresolved check semantics are admitted."""
    for room in migration.rooms:
        store.put_room(room)
    for task in migration.tasks:
        store.put_task(task)
    for check in migration.checks:
        store.put_check(check)
    for event in migration.events:
        store.append_event(event)
