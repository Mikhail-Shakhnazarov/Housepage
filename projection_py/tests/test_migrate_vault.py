import json
from pathlib import Path
import tempfile
import unittest

from housepage_projection.core import Answer, DealRequest, deal_tasks
from housepage_projection.migrate_vault import (
    apply_vault_migration,
    parse_vault_documents,
)
from housepage_projection.storage import SQLiteHouseholdStore


SETTINGS = json.dumps(
    {
        "schema_version": 1,
        "defaults": {
            "hand_size": 3,
            "scan_first": True,
            "time_buckets_min": [5, 10, 20],
            "energy_scale": "1-5",
        },
        "rooms": [{"id": "kitchen", "label": "Kitchen"}],
    }
)

TASKS = json.dumps(
    {
        "schema_version": 1,
        "tasks": [
            {
                "id": "sink",
                "title": "Clear sink",
                "room": "kitchen",
                "kind": "clean",
                "effort": 2,
                "minutes_est": 10,
                "frequency_days": 1,
            }
        ],
    }
)

CHECKS = json.dumps(
    {
        "schema_version": 1,
        "checks": [
            {
                "id": "anything-out",
                "room": "kitchen",
                "prompt": "Is there anything left out?",
                "linked_task_ids": ["sink"],
            }
        ],
    }
)

EVENTS = "\n".join(
    [
        json.dumps(
            {
                "schema_version": 1,
                "event_id": "event:scan",
                "type": "scan_answer",
                "ts": "2026-08-12T11:00:00+00:00",
                "client_ts": "2026-08-12T10:59:58+00:00",
                "session_id": "session:1",
                "device_id": "phone:1",
                "room": "kitchen",
                "check_id": "anything-out",
                "answer": "yes",
            }
        ),
        json.dumps(
            {
                "schema_version": 1,
                "event_id": "event:deal",
                "type": "deal",
                "ts": "2026-08-12T11:01:00+00:00",
                "session_id": "session:1",
                "device_id": "phone:1",
                "room": "kitchen",
                "energy": 3,
                "time_min": 20,
                "hand_size": 1,
                "task_ids": ["sink"],
            }
        ),
    ]
)


class VaultMigrationTests(unittest.TestCase):
    def test_migration_preserves_data_but_blocks_ambiguous_check_semantics(self) -> None:
        migration = parse_vault_documents(
            settings_text=SETTINGS,
            tasks_text=TASKS,
            checks_text=CHECKS,
            events_text=EVENTS,
        )
        self.assertEqual(migration.unresolved_check_ids, ("anything-out",))
        self.assertIsNone(migration.checks[0].trigger_answer)
        self.assertEqual(migration.events[0].client_ts.isoformat(), "2026-08-12T10:59:58+00:00")
        self.assertEqual(migration.events[1].task_ids, ("sink",))

        deal = deal_tasks(
            request=DealRequest(room="kitchen", energy=5, time_min=30),
            now=migration.events[1].ts,
            tasks=migration.tasks,
            checks=migration.checks,
            events=migration.events,
        )
        sink = next(item for item in deal.items if item.task_id == "sink")
        self.assertNotIn("scan", sink.reason_codes)

    def test_reviewed_trigger_can_be_admitted_without_rewriting_event_history(self) -> None:
        migration = parse_vault_documents(
            settings_text=SETTINGS,
            tasks_text=TASKS,
            checks_text=CHECKS,
            events_text=EVENTS,
        )
        reviewed_check = migration.checks[0].__class__(
            id=migration.checks[0].id,
            room=migration.checks[0].room,
            prompt=migration.checks[0].prompt,
            linked_task_ids=migration.checks[0].linked_task_ids,
            trigger_answer=Answer.YES,
        )
        deal = deal_tasks(
            request=DealRequest(room="kitchen", energy=5, time_min=30),
            now=migration.events[1].ts,
            tasks=migration.tasks,
            checks=(reviewed_check,),
            events=migration.events,
        )
        sink = next(item for item in deal.items if item.task_id == "sink")
        self.assertIn("scan", sink.reason_codes)

    def test_migration_loads_into_projection_store_without_losing_events(self) -> None:
        migration = parse_vault_documents(
            settings_text=SETTINGS,
            tasks_text=TASKS,
            checks_text=CHECKS,
            events_text=EVENTS,
        )
        with tempfile.TemporaryDirectory() as directory:
            store = SQLiteHouseholdStore(Path(directory) / "house.sqlite3")
            apply_vault_migration(store, migration)
            self.assertEqual(store.checks()[0].trigger_answer, None)
            self.assertEqual(store.events(), migration.events)
            self.assertEqual(len(store.definition_history("check", "anything-out")), 1)


if __name__ == "__main__":
    unittest.main()
