from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class Task(BaseModel):
    id: str
    title: str
    room: str
    effort: int = Field(ge=1, le=5)
    minutes_est: int = Field(ge=1)
    frequency_days: int | None = Field(default=None, ge=1)
    kind: str
    notes: str | None = None


class TasksFile(BaseModel):
    schema_version: int
    tasks: list[Task]


class Check(BaseModel):
    id: str
    room: str
    prompt: str
    linked_task_ids: list[str]
    notes: str | None = None


class ChecksFile(BaseModel):
    schema_version: int
    checks: list[Check]


class Room(BaseModel):
    id: str
    label: str


class Defaults(BaseModel):
    hand_size: int = Field(ge=1, le=10)
    scan_first: bool
    time_buckets_min: list[int]
    energy_scale: str


class Settings(BaseModel):
    schema_version: int
    defaults: Defaults
    rooms: list[Room]


class ScanAnswer(BaseModel):
    check_id: str
    answer: Literal["yes", "no"]


class ScanSubmitRequest(BaseModel):
    room: str
    answers: list[ScanAnswer]
    session_id: str | None = None
    device_id: str | None = None
    client_ts: str | None = None


class ScanSubmitResponse(BaseModel):
    ok: bool
    session_id: str


class DealRequest(BaseModel):
    room: str
    energy: int = Field(ge=1, le=5)
    time_min: int = Field(ge=1)
    hand_size: int = Field(default=3, ge=1, le=10)
    session_id: str | None = None
    device_id: str | None = None
    client_ts: str | None = None


class DealTaskView(BaseModel):
    task_id: str
    title: str
    room: str
    effort: int
    minutes_est: int
    score: float


class DealResponse(BaseModel):
    tasks: list[DealTaskView]
    session_id: str


class TaskActionRequest(BaseModel):
    task_id: str
    action: Literal["done", "skip"]
    room: str | None = None
    energy: int | None = Field(default=None, ge=1, le=5)
    time_min: int | None = Field(default=None, ge=1)
    hand_size: int | None = Field(default=None, ge=1, le=10)
    session_id: str | None = None
    device_id: str | None = None
    client_ts: str | None = None
    current_hand_task_ids: list[str] | None = None


class TaskActionResponse(BaseModel):
    ok: bool
    session_id: str
    replacement_task: DealTaskView | None = None


class DefHashesResponse(BaseModel):
    tasks_sha256: str
    checks_sha256: str
    settings_sha256: str


class TaskUpsertRequest(BaseModel):
    task: Task
    if_match_sha256: str | None = None


class TaskDeleteRequest(BaseModel):
    task_id: str
    if_match_sha256: str | None = None


class CheckUpsertRequest(BaseModel):
    check: Check
    if_match_sha256: str | None = None


class CheckDeleteRequest(BaseModel):
    check_id: str
    if_match_sha256: str | None = None


class WriteResponse(BaseModel):
    ok: bool
    sha256: str
