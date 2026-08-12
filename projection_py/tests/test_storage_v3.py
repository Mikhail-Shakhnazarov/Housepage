from datetime import datetime, timezone
from pathlib import Path
import sqlite3
import tempfile
import unittest

from housepage_projection.core import Answer, Check, Event, Task
from housepage_projection.storage import (
    DefinitionConflict,
    RoomDefinition,
    SQLiteHouseholdStore,
)


NOW = datetime(2026, 8, 12, 12, tzinfo=timezone.utc)


class StorageV3Tests(unittest.TestCase):
    def test_definition_revision_requires_current_hash(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = SQLiteHouseholdStore(Path(directory) / "house.sqlite3")
            first_hash = store.put_task(
                Task("sink", "Clear the sink", "kitchen", "clean", 2, 10, 1)
            )
            second_hash = store.revise_task(
                Task("sink", "Clear and dry the sink", "kitchen", "clean", 2, 12, 1),
                expected_hash=first_hash,
                actor="operator",
                updated_at=NOW,
            )
            self.assertNotEqual(first_hash, second_hash)
            history = store.definition_history("task", "sink")
            self.assertEqual([revision.version for revision in history], [1, 2])
            self.assertEqual(history[-1].actor, "operator")
            with self.assertRaises(DefinitionConflict):
                store.revise_task(
                    Task("sink", "Stale edit", "kitchen", "clean", 2, 8, 1),
                    expected_hash=first_hash,
                    actor="stale-client",
                    updated_at=NOW,
                )
            self.assertEqual(store.current_definition_hash("task", "sink"), second_hash)

    def test_full_event_provenance_survives_bundle_round_trip(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            first = SQLiteHouseholdStore(Path(directory) / "first.sqlite3")
            first.put_room(RoomDefinition("kitchen", "Kitchen", 1))
            first.put_task(Task("sink", "Clear sink", "kitchen", "clean", 2, 10, 1))
            first.put_check(
                Check("sink-clear", "kitchen", "Is the sink clear?", ("sink",), Answer.NO)
            )
            event = Event(
                type="deal",
                ts=NOW,
                event_id="event:1",
                session_id="session:1",
                device_id="device:a",
                client_ts=NOW,
                room="kitchen",
                energy=2,
                time_min=20,
                hand_size=1,
                task_ids=("sink",),
            )
            first.append_event(event)
            bundle = first.export_bundle()

            second = SQLiteHouseholdStore(Path(directory) / "second.sqlite3")
            second.replace_from_bundle(bundle)
            self.assertEqual(second.events(), first.events())
            restored = second.events()[0]
            self.assertEqual(restored.event_id, "event:1")
            self.assertEqual(restored.session_id, "session:1")
            self.assertEqual(restored.device_id, "device:a")
            self.assertEqual(restored.task_ids, ("sink",))
            self.assertEqual(restored.energy, 2)
            self.assertEqual(restored.time_min, 20)

    def test_schema_v1_store_upgrades_without_inventing_check_polarity(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "legacy.sqlite3"
            connection = sqlite3.connect(path)
            connection.executescript(
                """
                CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
                INSERT INTO metadata(key,value) VALUES('schema_version','1');
                CREATE TABLE rooms(id TEXT PRIMARY KEY,name TEXT NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0);
                CREATE TABLE checks(id TEXT PRIMARY KEY,room TEXT NOT NULL,prompt TEXT NOT NULL,linked_task_ids_json TEXT NOT NULL);
                CREATE TABLE tasks(id TEXT PRIMARY KEY,title TEXT NOT NULL,room TEXT NOT NULL,kind TEXT NOT NULL,effort INTEGER NOT NULL,minutes_est INTEGER NOT NULL,frequency_days INTEGER);
                CREATE TABLE events(seq INTEGER PRIMARY KEY AUTOINCREMENT,type TEXT NOT NULL,ts TEXT NOT NULL,room TEXT,task_id TEXT,check_id TEXT,answer TEXT);
                INSERT INTO rooms VALUES('kitchen','Kitchen',1);
                INSERT INTO tasks VALUES('sink','Clear sink','kitchen','clean',2,10,1);
                INSERT INTO checks VALUES('ambiguous','kitchen','Anything left out?','["sink"]');
                """
            )
            connection.commit()
            connection.close()

            store = SQLiteHouseholdStore(path)
            check = store.checks()[0]
            self.assertIsNone(check.trigger_answer)
            self.assertEqual(store.definition_history("check", "ambiguous")[0].version, 1)


if __name__ == "__main__":
    unittest.main()
