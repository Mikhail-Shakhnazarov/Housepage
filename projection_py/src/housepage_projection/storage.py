from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import sqlite3
from typing import Any

from .core import Answer, Check, Event, Task


SCHEMA_VERSION = "2"


@dataclass(frozen=True, slots=True)
class RoomDefinition:
    id: str
    name: str
    sort_order: int = 0


@dataclass(frozen=True, slots=True)
class DefinitionRevision:
    entity_kind: str
    entity_id: str
    version: int
    body: dict[str, Any]
    body_sha256: str
    actor: str
    updated_at: datetime


class StoreError(RuntimeError):
    pass


class DefinitionConflict(StoreError):
    pass


def _canonical_json(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _body_hash(value: dict[str, Any]) -> str:
    return sha256(_canonical_json(value).encode("utf-8")).hexdigest()


def _room_body(room: RoomDefinition) -> dict[str, Any]:
    return {"id": room.id, "name": room.name, "sort_order": room.sort_order}


def _check_body(check: Check) -> dict[str, Any]:
    return {
        "id": check.id,
        "room": check.room,
        "prompt": check.prompt,
        "linked_task_ids": list(check.linked_task_ids),
    }


def _task_body(task: Task) -> dict[str, Any]:
    return {
        "id": task.id,
        "title": task.title,
        "room": task.room,
        "kind": task.kind,
        "effort": task.effort,
        "minutes_est": task.minutes_est,
        "frequency_days": task.frequency_days,
    }


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
        connection.execute("PRAGMA synchronous=FULL")
        return connection

    @staticmethod
    def _create_current_schema(connection: sqlite3.Connection) -> None:
        connection.executescript(
            """
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
                event_id TEXT,
                session_id TEXT,
                device_id TEXT,
                client_ts TEXT,
                room TEXT,
                task_id TEXT,
                check_id TEXT,
                answer TEXT CHECK(answer IS NULL OR answer IN ('yes','no')),
                energy INTEGER,
                time_min INTEGER,
                hand_size INTEGER,
                task_ids_json TEXT NOT NULL DEFAULT '[]'
            );
            CREATE TABLE IF NOT EXISTS definition_revisions (
                seq INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_kind TEXT NOT NULL CHECK(entity_kind IN ('room','check','task')),
                entity_id TEXT NOT NULL,
                version INTEGER NOT NULL CHECK(version >= 1),
                body_json TEXT NOT NULL,
                body_sha256 TEXT NOT NULL,
                actor TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(entity_kind, entity_id, version)
            );
            CREATE INDEX IF NOT EXISTS idx_events_task_ts ON events(task_id, ts);
            CREATE INDEX IF NOT EXISTS idx_events_room_ts ON events(room, ts);
            CREATE INDEX IF NOT EXISTS idx_events_check_ts ON events(check_id, ts);
            CREATE INDEX IF NOT EXISTS idx_events_id ON events(event_id);
            CREATE INDEX IF NOT EXISTS idx_definition_revisions
                ON definition_revisions(entity_kind, entity_id, version);
            """
        )

    @staticmethod
    def _event_columns(connection: sqlite3.Connection) -> set[str]:
        return {str(row[1]) for row in connection.execute("PRAGMA table_info(events)")}

    @classmethod
    def _upgrade_v1_to_v2(cls, connection: sqlite3.Connection) -> None:
        columns = cls._event_columns(connection)
        additions = {
            "event_id": "TEXT",
            "session_id": "TEXT",
            "device_id": "TEXT",
            "client_ts": "TEXT",
            "energy": "INTEGER",
            "time_min": "INTEGER",
            "hand_size": "INTEGER",
            "task_ids_json": "TEXT NOT NULL DEFAULT '[]'",
        }
        for name, sql_type in additions.items():
            if name not in columns:
                connection.execute(f"ALTER TABLE events ADD COLUMN {name} {sql_type}")
        cls._create_current_schema(connection)
        cls._seed_definition_revisions(connection, actor="migration:v1-v2")

    @staticmethod
    def _seed_definition_revisions(connection: sqlite3.Connection, *, actor: str) -> None:
        existing = connection.execute(
            "SELECT 1 FROM definition_revisions LIMIT 1"
        ).fetchone()
        if existing is not None:
            return
        updated_at = datetime.now(timezone.utc).isoformat()

        for row in connection.execute("SELECT id,name,sort_order FROM rooms ORDER BY id"):
            body = {"id": row["id"], "name": row["name"], "sort_order": row["sort_order"]}
            SQLiteHouseholdStore._insert_revision(
                connection, "room", str(row["id"]), 1, body, actor, updated_at
            )
        for row in connection.execute(
            "SELECT id,room,prompt,linked_task_ids_json FROM checks ORDER BY id"
        ):
            body = {
                "id": row["id"],
                "room": row["room"],
                "prompt": row["prompt"],
                "linked_task_ids": json.loads(str(row["linked_task_ids_json"])),
            }
            SQLiteHouseholdStore._insert_revision(
                connection, "check", str(row["id"]), 1, body, actor, updated_at
            )
        for row in connection.execute(
            "SELECT id,title,room,kind,effort,minutes_est,frequency_days FROM tasks ORDER BY id"
        ):
            body = {
                "id": row["id"],
                "title": row["title"],
                "room": row["room"],
                "kind": row["kind"],
                "effort": row["effort"],
                "minutes_est": row["minutes_est"],
                "frequency_days": row["frequency_days"],
            }
            SQLiteHouseholdStore._insert_revision(
                connection, "task", str(row["id"]), 1, body, actor, updated_at
            )

    @staticmethod
    def _insert_revision(
        connection: sqlite3.Connection,
        entity_kind: str,
        entity_id: str,
        version: int,
        body: dict[str, Any],
        actor: str,
        updated_at: str,
    ) -> str:
        digest = _body_hash(body)
        connection.execute(
            """
            INSERT INTO definition_revisions(
                entity_kind,entity_id,version,body_json,body_sha256,actor,updated_at
            ) VALUES(?,?,?,?,?,?,?)
            """,
            (
                entity_kind,
                entity_id,
                version,
                _canonical_json(body),
                digest,
                actor,
                updated_at,
            ),
        )
        return digest

    def _migrate(self) -> None:
        with self._connect() as connection:
            connection.execute(
                "CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL)"
            )
            row = connection.execute(
                "SELECT value FROM metadata WHERE key='schema_version'"
            ).fetchone()
            if row is None:
                self._create_current_schema(connection)
                connection.execute(
                    "INSERT INTO metadata(key,value) VALUES('schema_version',?)",
                    (SCHEMA_VERSION,),
                )
                return

            version = str(row["value"])
            if version == "1":
                self._upgrade_v1_to_v2(connection)
                connection.execute(
                    "UPDATE metadata SET value=? WHERE key='schema_version'",
                    (SCHEMA_VERSION,),
                )
            elif version == SCHEMA_VERSION:
                self._create_current_schema(connection)
            else:
                raise StoreError(
                    f"unsupported household store schema {version}; expected <= {SCHEMA_VERSION}"
                )

    def _current_revision_row(
        self, connection: sqlite3.Connection, entity_kind: str, entity_id: str
    ) -> sqlite3.Row | None:
        return connection.execute(
            """
            SELECT version,body_json,body_sha256,actor,updated_at
            FROM definition_revisions
            WHERE entity_kind=? AND entity_id=?
            ORDER BY version DESC LIMIT 1
            """,
            (entity_kind, entity_id),
        ).fetchone()

    def _write_definition(
        self,
        *,
        entity_kind: str,
        entity_id: str,
        body: dict[str, Any],
        expected_hash: str | None,
        actor: str,
        updated_at: datetime,
    ) -> str:
        if updated_at.tzinfo is None:
            raise ValueError("updated_at must be timezone-aware")
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            current = self._current_revision_row(connection, entity_kind, entity_id)
            if current is None:
                if expected_hash is not None:
                    raise DefinitionConflict(
                        f"{entity_kind}:{entity_id} does not exist; expected hash cannot match"
                    )
                version = 1
            else:
                current_hash = str(current["body_sha256"])
                if expected_hash != current_hash:
                    raise DefinitionConflict(
                        f"definition conflict for {entity_kind}:{entity_id}; "
                        f"expected {expected_hash!r}, current {current_hash}"
                    )
                version = int(current["version"]) + 1

            if entity_kind == "room":
                connection.execute(
                    """
                    INSERT INTO rooms(id,name,sort_order) VALUES(?,?,?)
                    ON CONFLICT(id) DO UPDATE SET name=excluded.name,sort_order=excluded.sort_order
                    """,
                    (body["id"], body["name"], body["sort_order"]),
                )
            elif entity_kind == "check":
                connection.execute(
                    """
                    INSERT INTO checks(id,room,prompt,linked_task_ids_json) VALUES(?,?,?,?)
                    ON CONFLICT(id) DO UPDATE SET
                        room=excluded.room,prompt=excluded.prompt,
                        linked_task_ids_json=excluded.linked_task_ids_json
                    """,
                    (
                        body["id"],
                        body["room"],
                        body["prompt"],
                        json.dumps(body["linked_task_ids"], separators=(",", ":")),
                    ),
                )
            elif entity_kind == "task":
                connection.execute(
                    """
                    INSERT INTO tasks(id,title,room,kind,effort,minutes_est,frequency_days)
                    VALUES(?,?,?,?,?,?,?)
                    ON CONFLICT(id) DO UPDATE SET
                        title=excluded.title,room=excluded.room,kind=excluded.kind,
                        effort=excluded.effort,minutes_est=excluded.minutes_est,
                        frequency_days=excluded.frequency_days
                    """,
                    (
                        body["id"],
                        body["title"],
                        body["room"],
                        body["kind"],
                        body["effort"],
                        body["minutes_est"],
                        body["frequency_days"],
                    ),
                )
            else:
                raise ValueError(f"unsupported definition kind: {entity_kind}")

            return self._insert_revision(
                connection,
                entity_kind,
                entity_id,
                version,
                body,
                actor,
                updated_at.isoformat(),
            )

    def put_room(self, room: RoomDefinition) -> str:
        return self._write_definition(
            entity_kind="room",
            entity_id=room.id,
            body=_room_body(room),
            expected_hash=None,
            actor="system:initial",
            updated_at=datetime.now(timezone.utc),
        )

    def put_check(self, check: Check) -> str:
        return self._write_definition(
            entity_kind="check",
            entity_id=check.id,
            body=_check_body(check),
            expected_hash=None,
            actor="system:initial",
            updated_at=datetime.now(timezone.utc),
        )

    def put_task(self, task: Task) -> str:
        return self._write_definition(
            entity_kind="task",
            entity_id=task.id,
            body=_task_body(task),
            expected_hash=None,
            actor="system:initial",
            updated_at=datetime.now(timezone.utc),
        )

    def revise_room(
        self, room: RoomDefinition, *, expected_hash: str, actor: str, updated_at: datetime
    ) -> str:
        return self._write_definition(
            entity_kind="room",
            entity_id=room.id,
            body=_room_body(room),
            expected_hash=expected_hash,
            actor=actor,
            updated_at=updated_at,
        )

    def revise_check(
        self, check: Check, *, expected_hash: str, actor: str, updated_at: datetime
    ) -> str:
        return self._write_definition(
            entity_kind="check",
            entity_id=check.id,
            body=_check_body(check),
            expected_hash=expected_hash,
            actor=actor,
            updated_at=updated_at,
        )

    def revise_task(
        self, task: Task, *, expected_hash: str, actor: str, updated_at: datetime
    ) -> str:
        return self._write_definition(
            entity_kind="task",
            entity_id=task.id,
            body=_task_body(task),
            expected_hash=expected_hash,
            actor=actor,
            updated_at=updated_at,
        )

    def definition_history(
        self, entity_kind: str, entity_id: str
    ) -> tuple[DefinitionRevision, ...]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT entity_kind,entity_id,version,body_json,body_sha256,actor,updated_at
                FROM definition_revisions
                WHERE entity_kind=? AND entity_id=? ORDER BY version
                """,
                (entity_kind, entity_id),
            ).fetchall()
        return tuple(
            DefinitionRevision(
                entity_kind=str(row["entity_kind"]),
                entity_id=str(row["entity_id"]),
                version=int(row["version"]),
                body=json.loads(str(row["body_json"])),
                body_sha256=str(row["body_sha256"]),
                actor=str(row["actor"]),
                updated_at=datetime.fromisoformat(str(row["updated_at"])),
            )
            for row in rows
        )

    def current_definition_hash(self, entity_kind: str, entity_id: str) -> str | None:
        history = self.definition_history(entity_kind, entity_id)
        return history[-1].body_sha256 if history else None

    def append_event(self, event: Event) -> int:
        with self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO events(
                    type,ts,event_id,session_id,device_id,client_ts,room,task_id,
                    check_id,answer,energy,time_min,hand_size,task_ids_json
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    event.type,
                    event.ts.isoformat(),
                    event.event_id,
                    event.session_id,
                    event.device_id,
                    event.client_ts.isoformat() if event.client_ts is not None else None,
                    event.room,
                    event.task_id,
                    event.check_id,
                    event.answer.value if event.answer is not None else None,
                    event.energy,
                    event.time_min,
                    event.hand_size,
                    json.dumps(list(event.task_ids), separators=(",", ":")),
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
                """
                SELECT type,ts,event_id,session_id,device_id,client_ts,room,task_id,
                       check_id,answer,energy,time_min,hand_size,task_ids_json
                FROM events ORDER BY seq
                """
            ).fetchall()
        return tuple(
            Event(
                type=str(r["type"]),
                ts=datetime.fromisoformat(str(r["ts"])),
                event_id=str(r["event_id"]) if r["event_id"] is not None else None,
                session_id=str(r["session_id"]) if r["session_id"] is not None else None,
                device_id=str(r["device_id"]) if r["device_id"] is not None else None,
                client_ts=datetime.fromisoformat(str(r["client_ts"]))
                if r["client_ts"] is not None
                else None,
                room=str(r["room"]) if r["room"] is not None else None,
                task_id=str(r["task_id"]) if r["task_id"] is not None else None,
                check_id=str(r["check_id"]) if r["check_id"] is not None else None,
                answer=Answer(str(r["answer"])) if r["answer"] is not None else None,
                energy=int(r["energy"]) if r["energy"] is not None else None,
                time_min=int(r["time_min"]) if r["time_min"] is not None else None,
                hand_size=int(r["hand_size"]) if r["hand_size"] is not None else None,
                task_ids=tuple(json.loads(str(r["task_ids_json"]))),
            )
            for r in rows
        )

    @staticmethod
    def _event_body(event: Event) -> dict[str, Any]:
        return {
            "type": event.type,
            "ts": event.ts.isoformat(),
            "event_id": event.event_id,
            "session_id": event.session_id,
            "device_id": event.device_id,
            "client_ts": event.client_ts.isoformat() if event.client_ts is not None else None,
            "room": event.room,
            "task_id": event.task_id,
            "check_id": event.check_id,
            "answer": event.answer.value if event.answer is not None else None,
            "energy": event.energy,
            "time_min": event.time_min,
            "hand_size": event.hand_size,
            "task_ids": list(event.task_ids),
        }

    def export_bundle(self) -> dict[str, object]:
        return {
            "schema_version": SCHEMA_VERSION,
            "rooms": [asdict(room) for room in self.rooms()],
            "checks": [asdict(check) for check in self.checks()],
            "tasks": [asdict(task) for task in self.tasks()],
            "events": [self._event_body(event) for event in self.events()],
            "definition_revisions": [
                {
                    "entity_kind": revision.entity_kind,
                    "entity_id": revision.entity_id,
                    "version": revision.version,
                    "body": revision.body,
                    "body_sha256": revision.body_sha256,
                    "actor": revision.actor,
                    "updated_at": revision.updated_at.isoformat(),
                }
                for kind, entity_id in (
                    [("room", room.id) for room in self.rooms()]
                    + [("check", check.id) for check in self.checks()]
                    + [("task", task.id) for task in self.tasks()]
                )
                for revision in self.definition_history(kind, entity_id)
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
                event_id=item.get("event_id"),
                session_id=item.get("session_id"),
                device_id=item.get("device_id"),
                client_ts=datetime.fromisoformat(item["client_ts"])
                if item.get("client_ts") is not None
                else None,
                room=item.get("room"),
                task_id=item.get("task_id"),
                check_id=item.get("check_id"),
                answer=Answer(item["answer"]) if item.get("answer") is not None else None,
                energy=item.get("energy"),
                time_min=item.get("time_min"),
                hand_size=item.get("hand_size"),
                task_ids=tuple(item.get("task_ids", [])),
            )
            for item in bundle.get("events", [])  # type: ignore[union-attr]
        ]
        revisions = list(bundle.get("definition_revisions", []))  # type: ignore[arg-type]

        with self._connect() as connection:
            connection.execute("DELETE FROM definition_revisions")
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
                body = self._event_body(event)
                connection.execute(
                    """
                    INSERT INTO events(
                        type,ts,event_id,session_id,device_id,client_ts,room,task_id,
                        check_id,answer,energy,time_min,hand_size,task_ids_json
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        body["type"],body["ts"],body["event_id"],body["session_id"],
                        body["device_id"],body["client_ts"],body["room"],body["task_id"],
                        body["check_id"],body["answer"],body["energy"],body["time_min"],
                        body["hand_size"],json.dumps(body["task_ids"],separators=(",", ":")),
                    ),
                )
            if revisions:
                for revision in revisions:
                    body = dict(revision["body"])
                    digest = _body_hash(body)
                    if digest != revision["body_sha256"]:
                        raise StoreError(
                            f"definition revision hash mismatch for {revision['entity_kind']}:{revision['entity_id']}"
                        )
                    self._insert_revision(
                        connection,
                        str(revision["entity_kind"]),
                        str(revision["entity_id"]),
                        int(revision["version"]),
                        body,
                        str(revision["actor"]),
                        str(revision["updated_at"]),
                    )
            else:
                self._seed_definition_revisions(connection, actor="restore:legacy-v2")
