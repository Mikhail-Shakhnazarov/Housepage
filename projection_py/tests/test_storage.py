from datetime import timedelta
from pathlib import Path
import tempfile
import unittest

from housepage_projection.core import Answer, Check, Event, Task, utc
from housepage_projection.storage import RoomDefinition, SQLiteHouseholdStore


class StorageTests(unittest.TestCase):
    def test_bundle_round_trip_preserves_definitions_and_events(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            first = SQLiteHouseholdStore(Path(directory) / "first.sqlite3")
            first.put_room(RoomDefinition("kitchen", "Kitchen", 1))
            first.put_task(Task("sink", "Clear the sink", "kitchen", "clean", 2, 10, 1))
            first.put_check(Check("sink-clear", "kitchen", "Is the sink clear?", ("sink",)))
            event = Event(
                type="scan_answer",
                ts=utc(2026, 8, 12, 12),
                room="kitchen",
                check_id="sink-clear",
                answer=Answer.NO,
            )
            first.append_event(event)

            bundle = first.export_bundle()
            second = SQLiteHouseholdStore(Path(directory) / "second.sqlite3")
            second.replace_from_bundle(bundle)

            self.assertEqual(second.rooms(), first.rooms())
            self.assertEqual(second.checks(), first.checks())
            self.assertEqual(second.tasks(), first.tasks())
            self.assertEqual(second.events(), first.events())

    def test_event_order_is_append_order(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = SQLiteHouseholdStore(Path(directory) / "house.sqlite3")
            now = utc(2026, 8, 12, 12)
            store.append_event(Event(type="task_skip", ts=now, task_id="a"))
            store.append_event(Event(type="task_done", ts=now - timedelta(days=1), task_id="b"))
            self.assertEqual([event.task_id for event in store.events()], ["a", "b"])


if __name__ == "__main__":
    unittest.main()
