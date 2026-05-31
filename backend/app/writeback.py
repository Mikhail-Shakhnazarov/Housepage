from __future__ import annotations

import hashlib
import json
import os
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def file_sha256(path: Path) -> str:
    if not path.exists():
        return sha256_hex(b"")
    return sha256_hex(path.read_bytes())


@dataclass(frozen=True)
class AtomicWriteResult:
    sha256: str
    bytes_written: int


def _timestamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def backup_file(path: Path, backups_dir: Path) -> Path | None:
    if not path.exists():
        return None
    backups_dir.mkdir(parents=True, exist_ok=True)
    backup_path = backups_dir / f"{path.stem}_backup_{_timestamp()}{path.suffix or '.json'}"
    shutil.copy2(path, backup_path)
    return backup_path


def atomic_write_json(path: Path, obj: dict[str, Any]) -> AtomicWriteResult:
    encoded = (json.dumps(obj, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_name(f".{path.name}.tmp")
    with tmp_path.open("wb") as handle:
        handle.write(encoded)
        handle.flush()
        os.fsync(handle.fileno())
    tmp_path.replace(path)
    return AtomicWriteResult(sha256=sha256_hex(encoded), bytes_written=len(encoded))
