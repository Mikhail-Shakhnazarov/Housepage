from datetime import datetime
import json
from pathlib import Path
import unittest

from housepage_projection.core import Answer, Check, DealRequest, Event, Task, deal_tasks


class ConformanceTests(unittest.TestCase):
    def test_deal_v2_vector(self) -> None:
        fixture = json.loads(
            (Path(__file__).parents[1] / "conformance" / "deal_v2.json").read_text(
                encoding="utf-8"
            )
        )
        request = DealRequest(**fixture["request"])
        tasks = tuple(Task(**item) for item in fixture["tasks"])
        checks = tuple(
            Check(
                id=item["id"],
                room=item["room"],
                prompt=item["prompt"],
                linked_task_ids=tuple(item["linked_task_ids"]),
                trigger_answer=Answer(item["trigger_answer"])
                if item.get("trigger_answer") is not None
                else None,
            )
            for item in fixture["checks"]
        )
        events = tuple(
            Event(
                type=item["type"],
                ts=datetime.fromisoformat(item["ts"]),
                room=item.get("room"),
                task_id=item.get("task_id"),
                check_id=item.get("check_id"),
                answer=Answer(item["answer"]) if item.get("answer") is not None else None,
            )
            for item in fixture["events"]
        )
        deal = deal_tasks(
            request=request,
            now=datetime.fromisoformat(fixture["now"]),
            tasks=tasks,
            checks=checks,
            events=events,
        )
        self.assertEqual(deal.algorithm_version, fixture["algorithm_version"])
        observed = [
            {
                "task_id": item.task_id,
                "score": item.score,
                "reason_codes": list(item.reason_codes),
            }
            for item in deal.items
        ]
        self.assertEqual(observed, fixture["expected_items"])


if __name__ == "__main__":
    unittest.main()
