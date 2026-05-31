from __future__ import annotations

import json

from fastapi import FastAPI
from fastapi import HTTPException
from fastapi import Request
from fastapi import status
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from datetime import datetime, timezone

from .config import load_config
from .deal import DealParams, deal_tasks
from .derive import read_events
from .metrics import compute_metrics
from .editing import delete_check_file, delete_task_file, upsert_check_file, upsert_task_file
from .events import EventEnvelope, new_event_id, new_session_id, utc_now_iso
from .models import (
    CheckDeleteRequest,
    CheckUpsertRequest,
    ChecksFile,
    DealRequest,
    ScanSubmitRequest,
    Settings,
    TaskActionRequest,
    TaskDeleteRequest,
    TaskUpsertRequest,
    TasksFile,
)
from .state import compute_state
from .storage import VaultPaths, append_event, read_json
from .writeback import atomic_write_json, backup_file, file_sha256


def create_app() -> FastAPI:
    app = FastAPI(title="Housepage Chore System", version="0.0.0")

    @app.middleware("http")
    async def request_log(request: Request, call_next):
        response = await call_next(request)
        # v0: simple stdout logging (replace with structured logging later)
        print(f"{request.method} {request.url.path} -> {response.status_code}")
        return response

    @app.get("/api/health")
    def health() -> dict[str, str]:
        cfg = load_config()
        vault = VaultPaths(root=cfg.vault_path)
        return {
            "ok": "true",
            "version": app.version,
            "device_id": cfg.device_id,
            "vault_dir": vault.root.name,
        }

    @app.get("/api/settings")
    def get_settings() -> JSONResponse:
        cfg = load_config()
        vault = VaultPaths(root=cfg.vault_path)
        try:
            raw = read_json(vault.settings_path)
            settings = Settings.model_validate(raw)
        except FileNotFoundError as e:
            raise HTTPException(status_code=500, detail=f"Missing settings file: {e.filename}") from e
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=500, detail=f"Malformed JSON in settings.json: {e}") from e
        except ValidationError as e:
            raise HTTPException(status_code=500, detail=f"Invalid settings schema: {e}") from e
        return JSONResponse(content=settings.model_dump())

    @app.get("/api/defs/hashes")
    def def_hashes() -> JSONResponse:
        cfg = load_config()
        vault = VaultPaths(root=cfg.vault_path)
        return JSONResponse(
            content={
                "tasks_sha256": file_sha256(vault.tasks_path),
                "checks_sha256": file_sha256(vault.checks_path),
                "settings_sha256": file_sha256(vault.settings_path),
            }
        )

    def _check_precondition(path, if_match_sha256: str | None) -> None:
        if if_match_sha256 is None:
            return
        current = file_sha256(path)
        if current != if_match_sha256:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "precondition_failed",
                    "expected_sha256": if_match_sha256,
                    "current_sha256": current,
                },
            )

    @app.get("/api/checks")
    def get_checks(room: str) -> JSONResponse:
        cfg = load_config()
        vault = VaultPaths(root=cfg.vault_path)
        try:
            raw = read_json(vault.checks_path)
            checks_file = ChecksFile.model_validate(raw)
        except FileNotFoundError as e:
            raise HTTPException(status_code=500, detail=f"Missing checks file: {e.filename}") from e
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=500, detail=f"Malformed JSON in checks.json: {e}") from e
        except ValidationError as e:
            raise HTTPException(status_code=500, detail=f"Invalid checks schema: {e}") from e

        filtered = [c for c in checks_file.checks if c.room == room]
        return JSONResponse(
            content={
                "schema_version": checks_file.schema_version,
                "room": room,
                "checks": [c.model_dump() for c in filtered],
            }
        )

    @app.get("/api/checks/all")
    def get_checks_all() -> JSONResponse:
        cfg = load_config()
        vault = VaultPaths(root=cfg.vault_path)
        try:
            raw = read_json(vault.checks_path)
            checks_file = ChecksFile.model_validate(raw)
        except FileNotFoundError as e:
            raise HTTPException(status_code=500, detail=f"Missing checks file: {e.filename}") from e
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=500, detail=f"Malformed JSON in checks.json: {e}") from e
        except ValidationError as e:
            raise HTTPException(status_code=500, detail=f"Invalid checks schema: {e}") from e
        return JSONResponse(content=checks_file.model_dump())

    @app.get("/api/tasks")
    def get_tasks() -> JSONResponse:
        cfg = load_config()
        vault = VaultPaths(root=cfg.vault_path)
        try:
            raw = read_json(vault.tasks_path)
            tasks_file = TasksFile.model_validate(raw)
        except FileNotFoundError as e:
            raise HTTPException(status_code=500, detail=f"Missing tasks file: {e.filename}") from e
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=500, detail=f"Malformed JSON in tasks.json: {e}") from e
        except ValidationError as e:
            raise HTTPException(status_code=500, detail=f"Invalid tasks schema: {e}") from e
        return JSONResponse(content=tasks_file.model_dump())

    @app.post("/api/tasks/upsert")
    def tasks_upsert(body: TaskUpsertRequest) -> JSONResponse:
        cfg = load_config()
        vault = VaultPaths(root=cfg.vault_path)
        _check_precondition(vault.tasks_path, body.if_match_sha256)

        raw = read_json(vault.tasks_path)
        edited = upsert_task_file(raw, body.task)

        backup_file(vault.tasks_path, vault.root / "backups")
        result = atomic_write_json(vault.tasks_path, edited.obj)
        return JSONResponse(content={"ok": True, "sha256": result.sha256})

    @app.post("/api/tasks/delete")
    def tasks_delete(body: TaskDeleteRequest) -> JSONResponse:
        cfg = load_config()
        vault = VaultPaths(root=cfg.vault_path)
        _check_precondition(vault.tasks_path, body.if_match_sha256)

        raw = read_json(vault.tasks_path)
        edited = delete_task_file(raw, body.task_id)
        if not edited.updated:
            return JSONResponse(content={"ok": True, "sha256": file_sha256(vault.tasks_path)})

        backup_file(vault.tasks_path, vault.root / "backups")
        result = atomic_write_json(vault.tasks_path, edited.obj)
        return JSONResponse(content={"ok": True, "sha256": result.sha256})

    @app.post("/api/checks/upsert")
    def checks_upsert(body: CheckUpsertRequest) -> JSONResponse:
        cfg = load_config()
        vault = VaultPaths(root=cfg.vault_path)
        _check_precondition(vault.checks_path, body.if_match_sha256)

        raw = read_json(vault.checks_path)
        edited = upsert_check_file(raw, body.check)

        backup_file(vault.checks_path, vault.root / "backups")
        result = atomic_write_json(vault.checks_path, edited.obj)
        return JSONResponse(content={"ok": True, "sha256": result.sha256})

    @app.post("/api/checks/delete")
    def checks_delete(body: CheckDeleteRequest) -> JSONResponse:
        cfg = load_config()
        vault = VaultPaths(root=cfg.vault_path)
        _check_precondition(vault.checks_path, body.if_match_sha256)

        raw = read_json(vault.checks_path)
        edited = delete_check_file(raw, body.check_id)
        if not edited.updated:
            return JSONResponse(content={"ok": True, "sha256": file_sha256(vault.checks_path)})

        backup_file(vault.checks_path, vault.root / "backups")
        result = atomic_write_json(vault.checks_path, edited.obj)
        return JSONResponse(content={"ok": True, "sha256": result.sha256})

    @app.post("/api/scan/submit")
    def submit_scan(body: ScanSubmitRequest) -> JSONResponse:
        cfg = load_config()
        vault = VaultPaths(root=cfg.vault_path)

        session_id = body.session_id or new_session_id()
        device_id = body.device_id or cfg.device_id
        for answer in body.answers:
            envelope = EventEnvelope(
                schema_version=cfg.schema_version,
                event_id=new_event_id(),
                ts=utc_now_iso(),
                session_id=session_id,
                device_id=device_id,
                client_ts=body.client_ts,
            )
            event = {
                **envelope.to_dict(),
                "type": "scan_answer",
                "room": body.room,
                "check_id": answer.check_id,
                "answer": answer.answer,
            }
            append_event(vault.events_path, event)

        return JSONResponse(content={"ok": True, "session_id": session_id})

    @app.post("/api/deal")
    def deal(body: DealRequest) -> JSONResponse:
        cfg = load_config()
        vault = VaultPaths(root=cfg.vault_path)

        session_id = body.session_id or new_session_id()
        device_id = body.device_id or cfg.device_id

        try:
            raw_tasks = read_json(vault.tasks_path)
            tasks_file = TasksFile.model_validate(raw_tasks)
            raw_checks = read_json(vault.checks_path)
            checks_file = ChecksFile.model_validate(raw_checks)
        except FileNotFoundError as e:
            raise HTTPException(status_code=500, detail=f"Missing definitions file: {e.filename}") from e
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=500, detail=f"Malformed JSON in definitions: {e}") from e
        except ValidationError as e:
            raise HTTPException(status_code=500, detail=f"Invalid definitions schema: {e}") from e

        events = read_events(vault.events_path)
        now = datetime.now(timezone.utc)
        task_views = deal_tasks(
            params=DealParams(
                room=body.room,
                energy=body.energy,
                time_min=body.time_min,
                hand_size=body.hand_size,
            ),
            now=now,
            tasks=tasks_file.tasks,
            checks=checks_file.checks,
            events=events,
        )

        envelope = EventEnvelope(
            schema_version=cfg.schema_version,
            event_id=new_event_id(),
            ts=utc_now_iso(),
            session_id=session_id,
            device_id=device_id,
            client_ts=body.client_ts,
        )
        append_event(
            vault.events_path,
            {
                **envelope.to_dict(),
                "type": "deal",
                "room": body.room,
                "energy": body.energy,
                "time_min": body.time_min,
                "hand_size": body.hand_size,
                "task_ids": [t["task_id"] for t in task_views],
            },
        )

        return JSONResponse(content={"tasks": task_views, "session_id": session_id})

    @app.post("/api/task/action")
    def task_action(body: TaskActionRequest) -> JSONResponse:
        cfg = load_config()
        vault = VaultPaths(root=cfg.vault_path)

        if body.action not in {"done", "skip"}:
            raise HTTPException(status_code=400, detail="Invalid action")

        session_id = body.session_id or new_session_id()
        device_id = body.device_id or cfg.device_id
        event_type = "task_done" if body.action == "done" else "task_skip"

        envelope = EventEnvelope(
            schema_version=cfg.schema_version,
            event_id=new_event_id(),
            ts=utc_now_iso(),
            session_id=session_id,
            device_id=device_id,
            client_ts=body.client_ts,
        )
        append_event(
            vault.events_path,
            {
                **envelope.to_dict(),
                "type": event_type,
                "task_id": body.task_id,
            },
        )

        replacement_task = None
        if body.room and body.energy is not None and body.time_min is not None:
            hand_size = body.hand_size or 1
            # v0: replacement uses hand_size=1 regardless of requested hand size.
            try:
                raw_tasks = read_json(vault.tasks_path)
                tasks_file = TasksFile.model_validate(raw_tasks)
                raw_checks = read_json(vault.checks_path)
                checks_file = ChecksFile.model_validate(raw_checks)
            except FileNotFoundError as e:
                raise HTTPException(status_code=500, detail=f"Missing definitions file: {e.filename}") from e
            except json.JSONDecodeError as e:
                raise HTTPException(status_code=500, detail=f"Malformed JSON in definitions: {e}") from e
            except ValidationError as e:
                raise HTTPException(status_code=500, detail=f"Invalid definitions schema: {e}") from e

            events = read_events(vault.events_path)
            now = datetime.now(timezone.utc)
            exclude_ids = set(body.current_hand_task_ids or [])
            exclude_ids.add(body.task_id)
            deal_views = deal_tasks(
                params=DealParams(
                    room=body.room,
                    energy=body.energy,
                    time_min=body.time_min,
                    hand_size=1,
                ),
                now=now,
                tasks=tasks_file.tasks,
                checks=checks_file.checks,
                events=events,
                exclude_task_ids=exclude_ids,
            )
            if deal_views:
                replacement_task = deal_views[0]

        return JSONResponse(
            content={
                "ok": True,
                "session_id": session_id,
                "replacement_task": replacement_task,
            }
        )

    @app.get("/api/state")
    def state(room: str) -> JSONResponse:
        cfg = load_config()
        vault = VaultPaths(root=cfg.vault_path)
        try:
            raw_tasks = read_json(vault.tasks_path)
            tasks_file = TasksFile.model_validate(raw_tasks)
            raw_checks = read_json(vault.checks_path)
            checks_file = ChecksFile.model_validate(raw_checks)
        except FileNotFoundError as e:
            raise HTTPException(status_code=500, detail=f"Missing definitions file: {e.filename}") from e
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=500, detail=f"Malformed JSON in definitions: {e}") from e
        except ValidationError as e:
            raise HTTPException(status_code=500, detail=f"Invalid definitions schema: {e}") from e

        events = read_events(vault.events_path)
        now = datetime.now(timezone.utc)
        rows = compute_state(
            now=now,
            room=room,
            tasks=tasks_file.tasks,
            checks=checks_file.checks,
            events=events,
        )
        return JSONResponse(content={"room": room, "tasks": rows})

    @app.get("/api/metrics")
    def metrics(days: int = 30) -> JSONResponse:
        cfg = load_config()
        vault = VaultPaths(root=cfg.vault_path)
        try:
            raw_tasks = read_json(vault.tasks_path)
            tasks_file = TasksFile.model_validate(raw_tasks)
            raw_checks = read_json(vault.checks_path)
            checks_file = ChecksFile.model_validate(raw_checks)
        except FileNotFoundError as e:
            raise HTTPException(status_code=500, detail=f"Missing definitions file: {e.filename}") from e
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=500, detail=f"Malformed JSON in definitions: {e}") from e
        except ValidationError as e:
            raise HTTPException(status_code=500, detail=f"Invalid definitions schema: {e}") from e

        tasks_by_id = {t.id: t.model_dump() for t in tasks_file.tasks}
        checks_by_id = {c.id: c.model_dump() for c in checks_file.checks}
        events = read_events(vault.events_path)
        now = datetime.now(timezone.utc)

        result = compute_metrics(
            now=now,
            days=days,
            tasks_by_id=tasks_by_id,
            checks_by_id=checks_by_id,
            events=events,
        )
        return JSONResponse(content=result.to_dict())

    return app


app = create_app()
