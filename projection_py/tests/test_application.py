from datetime import datetime, timezone
from pathlib import Path
import tempfile
import unittest

from housepage_projection.application import RitualError, RitualService
from housepage_projection.core import Answer, Check, Task
from housepage_projection.storage import RoomDefinition, SQLiteHouseholdStore


NOW = datetime(2026, 8, 12, 12, tzinfo=timezone.utc)


class Ids:
    def __init__(self) -> None:
        self.i = 0

    def __call__(self, prefix: str) -> str:
        self.i += 1
        return f"{prefix}:{self.i}"


class ApplicationTests(unittest.TestCase):
    def service(self, directory: str) -> tuple[SQLiteHouseholdStore, RitualService]:
        store = SQLiteHouseholdStore(Path(directory) / "house.sqlite3")
        store.put_room(RoomDefinition("kitchen", "Kitchen", 1))
        store.put_task(Task("sink", "Clear sink", "kitchen", "clean", 2, 10, 1))
        store.put_check(
            Check("sink-clear", "kitchen", "Is the sink clear?", ("sink",), Answer.NO)
        )
        return store, RitualService(
            store,
            now=lambda: NOW,
            new_id=Ids(),
            device_id="test-device",
        )

    def test_scan_deal_done_is_one_replayable_event_sequence(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store, service = self.service(directory)
            session = service.start_scan("kitchen")
            service.submit_scan(session, {"sink-clear": Answer.NO})
            recorded_deal = service.deal(session, energy=3, time_min=20, hand_size=1)
            self.assertEqual(recorded_deal.deal.items[0].task_id, "sink")
            service.record_action(session, task_id="sink", action="done")

            events = store.events()
            self.assertEqual(
                [event.type for event in events],
                ["scan_started", "scan_answer", "scan_completed", "deal", "task_done"],
            )
            self.assertTrue(all(event.session_id == session.id for event in events))
            self.assertTrue(all(event.device_id == "test-device" for event in events))
            self.assertEqual(events[3].task_ids, ("sink",))

    def test_scan_submission_requires_exact_check_set(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            _store, service = self.service(directory)
            session = service.start_scan("kitchen")
            with self.assertRaises(RitualError):
                service.submit_scan(session, {})
            with self.assertRaises(RitualError):
                service.submit_scan(
                    session,
                    {"sink-clear": Answer.NO, "invented": Answer.YES},
                )

    def test_action_must_belong_to_latest_hand_and_happen_once(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            _store, service = self.service(directory)
            session = service.start_scan("kitchen")
            service.submit_scan(session, {"sink-clear": Answer.YES})
            with self.assertRaises(RitualError):
                service.record_action(session, task_id="sink", action="done")
            service.deal(session, energy=3, time_min=20, hand_size=1)
            service.record_action(session, task_id="sink", action="skip")
            with self.assertRaises(RitualError):
                service.record_action(session, task_id="sink", action="done")


if __name__ == "__main__":
    unittest.main()
