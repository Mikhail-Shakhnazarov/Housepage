from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
import json
from pathlib import Path
import sqlite3
from typing import Iterable

from .core import Answer, Check, Event, Task


SCHEMA_VERSION = "1"


@dataclass(frozen=True, slots=True)
class RoomDefinition:
    id: str
    name: str
    sort_order: int = 0


class StoreError(RuntimeError):
    pass


class SQLiteHouseholdStore:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._migrate()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA journal_mode=WAL")
        return connection

    def _migrate(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS rooms (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    sort_order INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS checks (
                    id TEXT PRIMARY KEY,
                    room TEXT NOT NULL,
                    prompt TEXT NOT NULL,
                    linked_task_ids_json TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    room TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    effort INTEGER NOT NULL CHECK(effort BETWEEN 1 AND 5),
                    minutes_est INTEGER NOT NULL CHECK(minutes_est > 0),
                    frequency_days INTEGER CHECK(frequency_days IS NULL OR frequency_days > 0)
                );
                CREATE TABLE IF NOT EXISTS events (
                    seq INTEGER PRIMARY KEY AUTOINCREMENT,
                    type TEXT NOT NULL,
                    ts TEXT NOT NULL,
                    room TEXT,
                    task_id TEXT,
                    check_id TEXT,
                    answer TEXT CHECK(answer IS NULL OR answer IN ('yes','no'))
                );
                CREATE INDEX IF NOT EXISTS idx_events_task_ts ON events(task_id, ts);
                CREATE INDEX IF NOT EXISTS idx_events_room_ts ON events(room, ts);
                CREATE INDEX IF NOT EXISTS idx_events_check_ts ON events(check_id, ts);
                """
            )
            row = connection.execute(
                "SELECT value FROM metadata WHERE key='schema_version'"
            ).fetchone()
            if row is None:
                connection.execute(
                    "INSERT INTO metadata(key,value) VALUES('schema_version',?)",
                    (SCHEMA_VERSION,),
                )
            elif row["value"] != SCHEMA_VERSION:
                raise StoreError(
                    f"unsupported household store schema {row['value']}; expected {SCHEMA_VERSION}"
                )

    def put_room(self, room: RoomDefinition) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO rooms(id,name,sort_order) VALUES(?,?,?)
                ON CONFLICT(id) DO UPDATE SET name=excluded.name, sort_order=excluded.sort_order
                """,
                (room.id, room.name, room.sort_order),
            )

    def put_check(self, check: Check) -> None:
        payload = json.dumps(list(check.linked_task_ids), separators=(",", ":"))
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO checks(id,room,prompt,linked_task_ids_json) VALUES(?,?,?,?)
                ON CONFLICT(id) DO UPDATE SET
                    room=excluded.room,
                    prompt=excluded.prompt,
                    linked_task_ids_json=excluded.linked_task_ids_json
                """,
                (check.id, check.room, check.prompt, payload),
            )

    def put_task(self, task: Task) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO tasks(id,title,room,kind,effort,minutes_est,frequency_days)
                VALUES(?,?,?,?,?,?,?)
                ON CONFLICT(id) DO UPDATE SET
                    title=excluded.title,
                    room=excluded.room,
                    kind=excluded.kind,
                    effort=excluded.effort,
                    minutes_est=excluded.minutes_est,
                    frequency_days=excluded.frequency_days
                """,
                (
                    task.id,
                    task.title,
                    task.room,
                    task.kind,
                    task.effort,
                    task.minutes_est,
                    task.frequency_days,
                ),
            )

    def append_event(self, event: Event) -> int:
        with self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO events(type,ts,room,task_id,check_id,answer)
                VALUES(?,?,?,?,?,?)
                """,
                (
                    event.type,
                    event.ts.isoformat(),
                    event.room,
                    event.task_id,
                    event.check_id,
                    event.answer.value if event.answer is not None else None,
                ),
            )
            return int(cursor.lastrowid)

    def rooms(self) -> tuple[RoomDefinition, ...]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT id,name,sort_order FROM rooms ORDER BY sort_order,name,id"
            ).fetchall()
        return tuple(RoomDefinition(str(r["id"]), str(r["name"]), int(r["sort_order"])) for r in rows)

    def checks(self) -> tuple[Check, ...]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT id,room,prompt,linked_task_ids_json FROM checks ORDER BY room,id"
            ).fetchall()
        return tuple(
            Check(
                id=str(r["id"]),
                room=str(r["room"]),
                prompt=str(r["prompt"]),
                linked_task_ids=tuple(json.loads(str(r["linked_task_ids_json"]))),
            )
            for r in rows
        )

    def tasks(self) -> tuple[Task, ...]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id,title,room,kind,effort,minutes_est,frequency_days
                FROM tasks ORDER BY room,title,id
                """
            ).fetchall()
        return tuple(
            Task(
                id=str(r["id"]),
                title=str(r["title"]),
                room=str(r["room"]),
                kind=str(r["kind"]),
                effort=int(r["effort"]),
                minutes_est=int(r["minutes_est"]),
                frequency_days=int(r["frequency_days"]) if r["frequency_days"] is not None else None,
            )
            for r in rows
        )

    def events(self) -> tuple[Event, ...]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT type,ts,room,task_id,check_id,answer FROM events ORDER BY seq"
            ).fetchall()
        return tuple(
            Event(
                type=str(r["type"]),
                ts=datetime.fromisoformat(str(r["ts"])),
                room=str(r["room"]) if r["room"] is not None else None,
                task_id=str(r["task_id"]) if r["task_id"] is not None else None,
                check_id=str(r["check_id"]) if r["check_id"] is not None else None,
                answer=Answer(str(r["answer"])) if r["answer"] is not None else None,
            )
            for r in rows
        )

    def export_bundle(self) -> dict[str, object]:
        return {
            "schema_version": SCHEMA_VERSION,
            "rooms": [asdict(room) for room in self.rooms()],
            "checks": [asdict(check) for check in self.checks()],
            "tasks": [asdict(task) for task in self.tasks()],
            "events": [
                {
                    "type": event.type,
                    "ts": event.ts.isoformat(),
                    "room": event.room,
                    "task_id": event.task_id,
                    "check_id": event.check_id,
                    "answer": event.answer.value if event.answer is not None else None,
                }
                for event in self.events()
            ],
        }

    def replace_from_bundle(self, bundle: dict[str, object]) -> None:
        if bundle.get("schema_version") != SCHEMA_VERSION:
            raise StoreError("unsupported import bundle schema")
        rooms = [RoomDefinition(**item) for item in bundle.get("rooms", [])]  # type: ignore[arg-type]
        checks = [
            Check(**{**item, "linked_task_ids": tuple(item["linked_task_ids"])})
            for item in bundle.get("checks", [])  # type: ignore[union-attr]
        ]
        tasks = [Task(**item) for item in bundle.get("tasks", [])]  # type: ignore[arg-type]
        events = [
            Event(
                type=item["type"],
                ts=datetime.fromisoformat(item["ts"]),
                room=item.get("room"),
                task_id=item.get("task_id"),
                check_id=item.get("check_id"),
                answer=Answer(item["answer"]) if item.get("answer") is not None else None,
            )
            for item in bundle.get("events", [])  # type: ignore[union-attr]
        ]
        with self._connect() as connection:
            connection.execute("DELETE FROM events")
            connection.execute("DELETE FROM checks")
            connection.execute("DELETE FROM tasks")
            connection.execute("DELETE FROM rooms")
            for room in rooms:
                connection.execute(
                    "INSERT INTO rooms(id,name,sort_order) VALUES(?,?,?)",
                    (room.id, room.name, room.sort_order),
                )
            for check in checks:
                connection.execute(
                    "INSERT INTO checks(id,room,prompt,linked_task_ids_json) VALUES(?,?,?,?)",
                    (
                        check.id,
                        check.room,
                        check.prompt,
                        json.dumps(list(check.linked_task_ids), separators=(",", ":")),
                    ),
                )
            for task in tasks:
                connection.execute(
                    """
                    INSERT INTO tasks(id,title,room,kind,effort,minutes_est,frequency_days)
                    VALUES(?,?,?,?,?,?,?)
                    """,
                    (
                        task.id,
                        task.title,
                        task.room,
                        task.kind,
                        task.effort,
                        task.minutes_est,
                        task.frequency_days,
                    ),
                )
            for event in events:
                connection.execute(
                    "INSERT INTO events(type,ts,room,task_id,check_id,answer) VALUES(?,?,?,?,?,?)",
                    (
                        event.type,
                        event.ts.isoformat(),
                        event.room,
                        event.task_id,
                        event.check_id,
                        event.answer.value if event.answer is not None else None,
                    ),
                )
