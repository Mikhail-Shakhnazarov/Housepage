from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .events import ndjson_line


@dataclass(frozen=True)
class VaultPaths:
    root: Path

    @property
    def settings_path(self) -> Path:
        return self.root / "settings.json"

    @property
    def tasks_path(self) -> Path:
        return self.root / "tasks.json"

    @property
    def checks_path(self) -> Path:
        return self.root / "checks.json"

    @property
    def events_path(self) -> Path:
        return self.root / "events.ndjson"


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def append_event(path: Path, event: dict[str, Any]) -> None:
    line = ndjson_line(event)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(line)
        handle.flush()
