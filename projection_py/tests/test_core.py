import unittest
from datetime import timedelta

from housepage_projection.core import (
    Answer,
    Check,
    DealRequest,
    Event,
    Task,
    deal_tasks,
    utc,
)


class HousepageCoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.now = utc(2026, 8, 12, 12)
        self.tasks = (
            Task("sink", "Clear the sink", "kitchen", "clean", 2, 10, 1),
            Task("floor", "Sweep floor", "kitchen", "clean", 3, 15, 3),
            Task("bins", "Take garbage out", "garbage", "tidy", 2, 10, 2),
        )
        self.checks = (
            Check("sink-clear", "kitchen", "Is the sink clear?", ("sink",), Answer.NO),
            Check("floor-clear", "kitchen", "Is the floor clear?", ("floor",), Answer.NO),
        )

    def test_energy_and_time_are_hard_eligibility_constraints(self) -> None:
        deal = deal_tasks(
            request=DealRequest(room="kitchen", energy=2, time_min=10),
            now=self.now,
            tasks=self.tasks,
            checks=self.checks,
            events=(),
        )
        self.assertEqual({item.task_id for item in deal.items}, {"sink", "bins"})

    def test_negative_scan_answer_boosts_negative_trigger_check(self) -> None:
        events = (
            Event(
                type="scan_answer",
                ts=self.now - timedelta(hours=1),
                room="kitchen",
                check_id="floor-clear",
                answer=Answer.NO,
            ),
        )
        deal = deal_tasks(
            request=DealRequest(room="kitchen", energy=5, time_min=30),
            now=self.now,
            tasks=self.tasks,
            checks=self.checks,
            events=events,
        )
        self.assertEqual(deal.items[0].task_id, "floor")
        self.assertIn("scan", deal.items[0].reason_codes)

    def test_positive_scan_answer_can_be_the_trigger(self) -> None:
        checks = (
            Check(
                "anything-out",
                "kitchen",
                "Is there anything left out?",
                ("sink",),
                Answer.YES,
            ),
        )
        event = Event(
            type="scan_answer",
            ts=self.now - timedelta(hours=1),
            room="kitchen",
            check_id="anything-out",
            answer=Answer.YES,
        )
        deal = deal_tasks(
            request=DealRequest(room="kitchen", energy=5, time_min=30),
            now=self.now,
            tasks=self.tasks,
            checks=checks,
            events=(event,),
        )
        sink = next(item for item in deal.items if item.task_id == "sink")
        self.assertIn("scan", sink.reason_codes)

    def test_unresolved_check_polarity_contributes_no_scan_boost(self) -> None:
        checks = (Check("ambiguous", "kitchen", "Legacy prompt", ("floor",), None),)
        event = Event(
            type="scan_answer",
            ts=self.now - timedelta(hours=1),
            room="kitchen",
            check_id="ambiguous",
            answer=Answer.NO,
        )
        deal = deal_tasks(
            request=DealRequest(room="kitchen", energy=5, time_min=30),
            now=self.now,
            tasks=self.tasks,
            checks=checks,
            events=(event,),
        )
        floor = next(item for item in deal.items if item.task_id == "floor")
        self.assertNotIn("scan", floor.reason_codes)

    def test_recent_skip_enforces_cooldown(self) -> None:
        events = (
            Event(type="task_skip", ts=self.now - timedelta(hours=2), task_id="sink"),
        )
        deal = deal_tasks(
            request=DealRequest(room="kitchen", energy=5, time_min=30),
            now=self.now,
            tasks=self.tasks,
            checks=self.checks,
            events=events,
        )
        self.assertNotIn("sink", {item.task_id for item in deal.items})

    def test_deal_is_deterministic_for_same_recorded_state(self) -> None:
        kwargs = dict(
            request=DealRequest(room="kitchen", energy=5, time_min=30),
            now=self.now,
            tasks=self.tasks,
            checks=self.checks,
            events=(),
        )
        self.assertEqual(deal_tasks(**kwargs), deal_tasks(**kwargs))

    def test_algorithm_version_is_recorded(self) -> None:
        deal = deal_tasks(
            request=DealRequest(room="kitchen", energy=5, time_min=30),
            now=self.now,
            tasks=self.tasks,
            checks=self.checks,
            events=(),
        )
        self.assertEqual(deal.algorithm_version, "deal-v2")


if __name__ == "__main__":
    unittest.main()
