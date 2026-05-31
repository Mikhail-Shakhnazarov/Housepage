from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from .models import Check, Task


@dataclass(frozen=True)
class FileEditResult:
    updated: bool
    obj: dict[str, Any]


def _ensure_list(obj: dict[str, Any], key: str) -> list[dict[str, Any]]:
    raw = obj.get(key)
    if raw is None:
        obj[key] = []
        return obj[key]  # type: ignore[return-value]
    if isinstance(raw, list):
        normalized: list[dict[str, Any]] = []
        for item in raw:
            if isinstance(item, dict):
                normalized.append(item)
        obj[key] = normalized
        return normalized
    obj[key] = []
    return obj[key]  # type: ignore[return-value]


def upsert_task_file(raw_obj: dict[str, Any], task: Task) -> FileEditResult:
    obj = dict(raw_obj)
    tasks = _ensure_list(obj, "tasks")

    new_data = task.model_dump()
    for idx, existing in enumerate(tasks):
        if existing.get("id") == task.id:
            merged = dict(existing)
            merged.update(new_data)
            tasks[idx] = merged
            return FileEditResult(updated=True, obj=obj)

    tasks.append(new_data)
    return FileEditResult(updated=True, obj=obj)


def delete_task_file(raw_obj: dict[str, Any], task_id: str) -> FileEditResult:
    obj = dict(raw_obj)
    tasks = _ensure_list(obj, "tasks")
    before_len = len(tasks)
    tasks[:] = [t for t in tasks if t.get("id") != task_id]
    return FileEditResult(updated=(len(tasks) != before_len), obj=obj)


def upsert_check_file(raw_obj: dict[str, Any], check: Check) -> FileEditResult:
    obj = dict(raw_obj)
    checks = _ensure_list(obj, "checks")

    new_data = check.model_dump()
    for idx, existing in enumerate(checks):
        if existing.get("id") == check.id:
            merged = dict(existing)
            merged.update(new_data)
            checks[idx] = merged
            return FileEditResult(updated=True, obj=obj)

    checks.append(new_data)
    return FileEditResult(updated=True, obj=obj)


def delete_check_file(raw_obj: dict[str, Any], check_id: str) -> FileEditResult:
    obj = dict(raw_obj)
    checks = _ensure_list(obj, "checks")
    before_len = len(checks)
    checks[:] = [c for c in checks if c.get("id") != check_id]
    return FileEditResult(updated=(len(checks) != before_len), obj=obj)

