from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import os


@dataclass(frozen=True)
class AppConfig:
    vault_path: Path
    device_id: str
    schema_version: int = 1


def load_config() -> AppConfig:
    vault_path_raw = os.environ.get("CHORE_VAULT_PATH", "").strip()
    if not vault_path_raw:
        raise RuntimeError("CHORE_VAULT_PATH is required (path to vault chore_system folder)")

    device_id = os.environ.get("CHORE_DEVICE_ID", "").strip() or "unknown_device"

    return AppConfig(vault_path=Path(vault_path_raw), device_id=device_id)

