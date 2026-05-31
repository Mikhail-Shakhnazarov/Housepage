from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_event_id() -> str:
    return str(uuid4())


def new_session_id() -> str:
    return str(uuid4())


@dataclass(frozen=True)
class EventEnvelope:
    schema_version: int
    event_id: str
    ts: str
    session_id: str
    device_id: str
    client_ts: str | None

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "schema_version": self.schema_version,
            "event_id": self.event_id,
            "ts": self.ts,
            "session_id": self.session_id,
            "device_id": self.device_id,
        }
        if self.client_ts:
            payload["client_ts"] = self.client_ts
        return payload


def ndjson_line(obj: dict[str, Any]) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n"

