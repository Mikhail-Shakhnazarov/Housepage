# Implementation Plan

Phased development plan for the scan-first home chore system.

---

## Assumptions (v0)

- Canonical vault artifacts are real `settings.json`, `tasks.json`, `checks.json`, and `events.ndjson` files inside an Obsidian vault folder.
- This repo’s `data/` directory is documentation/examples only; the app reads from `CHORE_VAULT_PATH`.
- Event schema is made “complete” as part of v0 (ids + versioning; optionally session/device fields).
- No N/A in v0 (scan and task actions are Yes/No and Done/Skip only).
- Backend writes are append-only to `events.ndjson` (atomic appends; no rewrites/compaction).
- Room is a context signal, not a strict filter (cross-room tasks are allowed).
- Weights/cooldowns exist in v0 as constants, with a clean stub for later settings-driven tuning.
- Phone-on-WiFi is iteration 1 (v0 defaults to local-only bind).

## Decisions (locked)

- Repo architecture: implement here as a monorepo (`backend/`, `frontend/`, `vault_sample/`).

- Event schema: Option C (device-aware). Event envelope includes `schema_version`, `event_id`, `ts` (server), `session_id`, `device_id`, and optional `client_ts`.

- Scan UI: checks require explicit Yes/No (no defaults).

- Cross-room policy: allow any task, but bias toward the selected room unless the score gap is large.

## Phase 0: Project Setup

**Goal:** Runnable skeleton with minimal functionality.

### Backend
- [x] Initialize Python project with `requirements.txt`
- [x] Create folder structure: `backend/app/{main,config,models,storage,events}.py`
- [x] Implement `config.py`: read `CHORE_VAULT_PATH` env var
- [x] Implement `storage.py`: load JSON definitions from vault path
- [x] Create FastAPI app with health check endpoint (`GET /api/health`)
- [x] Add `GET /api/settings` endpoint (returns parsed `settings.json`)
- [x] Define and implement the v0 event envelope (Option C) utilities (event id, timestamps, session id, device id)

### Frontend
- [x] Initialize React project (Vite)
- [x] Configure proxy to backend (`/api` → `127.0.0.1:8000`)
- [x] Create basic app shell that fetches `/api/settings`

### Vault Setup
- [x] Create sample vault folder with real JSON files: `settings.json`, `tasks.json`, `checks.json`
- [x] Create empty `events.ndjson`
- [x] Use repo-local sample vault for development: `vault_sample/chore_system/`

### Dev launcher

- [x] Add `./scripts/dev.sh` to run backend + frontend locally (v0 local bind)

**Exit criteria:** `uvicorn app.main:app` runs, `GET /api/settings` returns room list, React app loads.

---

## Phase 1: Read Path (Definitions)

**Goal:** Backend serves all definition data; frontend displays room list.

### Backend
- [x] Implement `GET /api/checks?room=<room_id>` — return checks for a room
- [x] Implement `GET /api/tasks` — return all tasks (debug/optional)
- [x] Add Pydantic models for Settings, Task, Check schemas
- [x] Handle missing/malformed JSON gracefully (return 500 with clear message)

### Frontend
- [x] Build Room Selection screen
  - [x] Fetch rooms from `/api/settings`
  - [x] Display room list as clickable items
  - [x] Navigate to scan screen on room select (checks loaded; submission is Phase 2)

**Exit criteria:** User can see room list and select a room.

---

## Phase 2: Scan Flow

**Goal:** Complete scan submission with event logging.

### Backend
- [x] Implement `storage.append_event()` — append single NDJSON line with flush
- [x] Implement `POST /api/scan/submit`
  - [x] Accept `{ room, answers: [{check_id, answer}] }`
  - [x] Write one `scan_answer` event per answer
  - [x] Return `{ ok: true, session_id }`
- [x] Implement event envelope (v0 Option C):
  - [x] `schema_version` (int)
  - [x] `event_id` (uuid string)
  - [x] `ts` (server timestamp, ISO 8601 with timezone)
  - [x] `session_id`
  - [x] `device_id`
  - [x] Optional `client_ts`

### Frontend
- [x] Build Scan screen
  - [x] Fetch checks for selected room
  - [x] Render each check as prompt with Yes/No buttons (v0 removes N/A)
  - [x] Require explicit Yes/No for each check before allowing submit (no defaults)
  - [x] Track answers in local state
  - [x] "Finish scan" button submits to `/api/scan/submit`
  - [x] Navigate to Energy/Time screen on success

**Exit criteria:** User completes scan, events appear in `events.ndjson`.

---

## Phase 3: Energy/Time Input

**Goal:** User inputs constraints before task deal.

### Frontend
- [x] Build Energy/Time screen
  - [x] Energy selector (1–5 scale)
  - [x] Time bucket selector (from `settings.json`)
  - [x] "Deal tasks" button stub (Phase 4 implements `/api/deal`)
  - [x] Store selections in app state for deal request

**Exit criteria:** User can input energy/time and proceed to deal.

---

## Phase 4: Derived State & Task Dealing

**Goal:** Backend computes task priorities and deals a hand.

### Backend
- [x] Implement `derive.py`: replay events to compute per-task state
  - [x] `last_done_ts` from `task_done` events
  - [x] `skip_count_recent` from `task_skip` events (7-day window)
  - [x] `scan_boost` from recent `scan_answer=no` events (decays over time)
- [x] Implement `deal.py`: filter, score, select tasks
  - [x] Filter: `effort <= energy`, `minutes_est <= time_min`, not in skip cooldown
  - [x] Score: `2*overdue + 3*scan_boost + comfort_boost - skip_penalty` (constants in v0)
  - [x] Room handling: treat `room` as context, not a strict filter; apply a room bias unless the score gap is large
  - [x] Select top N (default 3)
- [x] Implement `POST /api/deal`
  - [x] Accept `{ room, energy, time_min, hand_size, session_id?, client_ts? }`
  - [x] Log `deal` event with returned `task_ids`
  - [x] Return `{ tasks: [...], session_id }`
- [x] Stub later tuning surface (iteration 1+): constants are centralized in `deal.py` as tunables

### Frontend
- [x] Update Energy/Time screen to call `/api/deal` on submit
- [x] Build Task Hand screen
  - [x] Display dealt tasks (title, minutes, effort, score)
  - [x] Done/Skip buttons stubbed (Phase 5 wires actions)

**Exit criteria:** User receives 3 relevant tasks based on scan + constraints.

---

## Phase 5: Task Actions & Completion

**Goal:** User marks task outcomes; system logs and optionally refills.

### Backend
- [x] Implement `POST /api/task/action`
  - [x] Accept `{ task_id, action, room, energy, time_min, session_id, client_ts, current_hand_task_ids }`
  - [x] Append `task_done` or `task_skip` event
  - [x] Optionally return `{ replacement_task }` (refill) if context provided

### Frontend
- [x] Wire Done/Skip buttons to `/api/task/action`
- [x] On action: replace task if server returns replacement, else remove it
- [x] "Done for now" is implicit when hand becomes empty

**Exit criteria:** Full loop works: scan → deal → mark outcomes → events logged.

---

## Phase 6: Polish & Edge Cases

**Goal:** Production-ready iteration 0.

### Backend
- [x] Add `GET /api/state?room=<id>` debug endpoint (derived scores)
- [ ] Concurrency stance (v0): one backend process is the single writer; rely on atomic appends; defer file locking to later if needed
- [x] Add request logging
- [ ] Validate all inputs with Pydantic

### Frontend
- [ ] Add loading states and error handling
- [ ] Style for mobile-first (primary use case)
- [ ] Add "skip scan" shortcut (go straight to deal with no boost)
- [ ] Persist room/energy/time as defaults in localStorage

### Testing
- [ ] Backend unit tests for derive and deal logic
- [ ] Integration test: full flow with sample vault
- [x] Manual test on phone over LAN (enabled by `CHORE_BIND=0.0.0.0` + `VITE_HOST=0.0.0.0`, no auth)

**Exit criteria:** System is usable daily without crashes or confusion.

---

## Future Phases (Post Iteration 0)

### Iteration 1: Phone-on-WiFi (trusted LAN)

- [x] Document the exact Wi-Fi run command and device access steps (LAN IP + ports).
- [x] Make launcher print “open this URL” hints:
  - [x] detect local LAN IP (best effort) and print `http://<ip>:5173`
  - [x] print backend URL `http://<ip>:8000`
- [x] Ensure backend accepts requests from phone browser in dev:
  - [x] use Vite dev server on `0.0.0.0` with proxy to backend on `0.0.0.0`
  - [x] note: if you later move to direct browser→backend calls (no proxy), add explicit CORS configuration then
- [x] Confirm event envelope fields are present on all event types:
  - [x] `device_id` and `client_ts` are recorded when provided by clients (frontend generates stable `device_id`)
- [x] Add a minimal “health+version” surface for debugging on phone:
  - [x] `GET /api/health` includes `version`, `device_id`, and `vault_dir`

Note: no auth token in iteration 1 (trusted LAN only). If you later want a gate, add it as iteration 1.5.

### Iteration 2: In-App Editing

Goal: edit definitions from the app without breaking the Obsidian-first contract.

Backend
- [x] Define write endpoints (atomic writes, schema-preserving):
  - [x] `POST /api/tasks/upsert` (create/update by `id`)
  - [x] `POST /api/tasks/delete`
  - [x] `POST /api/checks/upsert`
  - [x] `POST /api/checks/delete`
- [x] Implement atomic write strategy:
  - [x] write to temp file in same directory
  - [x] fsync/flush
  - [x] rename over the original
- [x] Preserve unknown fields:
  - [x] load raw JSON
  - [x] validate known fields (Pydantic in read paths; writes merge into raw dict)
  - [x] merge updates without dropping unrecognized keys
- [x] Add backups on write:
  - [x] keep `*_backup_YYYYMMDD_HHMMSS.json` in a `backups/` subfolder
- [x] Add conflict detection:
  - [x] accept `if_match_sha256` (hash of last-read file) and reject if changed (409)

Frontend
- [ ] Add Library screens:
  - [ ] task list + search/filter
  - [x] task editor (title/room/effort/minutes/frequency/kind)
  - [x] checks editor (prompt + linked tasks)
- [x] Add “Open in Obsidian” affordance (copy path, not deep-link) for the source JSON files.

Exit criteria: you can add/edit a task and a check in-app; the vault JSON remains valid and diff-friendly.

---

## Task and check organization (next content pass)

Decisions locked for the first curation pass:

- Add a `SHOPPING` stub category now (implementation and scoring rules will come later).
- Keep per-room garbage checks (do not collapse into one “garbage scan”).
- Split dishwasher into two checks (empty vs needs run).
- Use baseline effort/time values for new tasks and iterate later.
- Canonical vault is the repo-local vault (`vault_sample/chore_system/` now; later may be moved into a real Obsidian vault directory).

Planned steps:

1) Add missing room/category ids to `settings.json`:
   - add `bedroom`
   - add `shopping` (stub)

2) Translate the proposed list in `tasks_and_checks.md` into:
   - tasks with stable ids (`t_<room>_<slug>`)
   - checks with stable ids (`c_<room>_<slug>`) linking to one or more tasks

3) Apply baseline defaults:
   - effort: default 2
   - minutes_est: default 5
   - kind: default `tidy` (override for `clean`, `admin`, etc.)

4) Garbage posture:
   - keep “garbage present?” checks per room
   - link them to shared garbage tasks where appropriate (to avoid duplicating tasks while keeping local prompts)

5) Dishwasher split (kitchen):
   - check A: “Is the dishwasher empty?”
   - check B: “Does the dishwasher need to run?”
   - tasks: `t_kitchen_empty_dishwasher`, `t_kitchen_run_dishwasher` (or one combined task if you later decide)

Exit criteria:
- All checks in `checks.json` reference valid task ids.
- All tasks reference valid rooms (including `bedroom` and `shopping`).
- App can scan any room and deal tasks without schema errors.

### Iteration 3: Live Reload & Migrations

Goal: editing in Obsidian and in-app stays smooth; schema changes don’t break old vaults.

Backend
- [ ] Add file watching (or mtime polling) for definitions:
  - [ ] invalidate in-memory caches (if any) on change
  - [ ] handle mid-edit malformed JSON: keep last-known-good and surface a warning state
- [ ] Define migration protocol:
  - [ ] explicit `schema_version` bump rules for `settings.json`, `tasks.json`, `checks.json`
  - [ ] per-file migration functions `vN -> vN+1`
- [ ] Add migration command:
  - [ ] `python -m backend.migrate --vault <path>` (or a small script)
  - [ ] always backup before migration
  - [ ] dry-run option that prints planned diffs

Frontend
- [ ] Surface “definitions changed” and “definitions invalid” states without crashing the UI.

Exit criteria: you can edit JSON in Obsidian while the app is running; invalid intermediate states don’t destroy the session.

### Iteration 4: Analytics & Tuning

Goal: tune the system from real usage without turning it into ML.

Backend
- [x] Add analytics endpoint(s) derived from `events.ndjson`:
  - [x] completions per task over time (basic counts)
  - [x] “checks no” counts (proxy for missed/failed checks)
  - [ ] skip rate and recent-skip windows
  - [ ] “friction” list (high skip count, low completion)
- [ ] Externalize tunables:
  - [ ] introduce `settings.tuning` (weights, cooldowns, windows)
  - [ ] validate and apply at runtime (default to safe constants if missing)
- [ ] Add a debug “why this task” explanation to deal response (optional):
  - [ ] include score components (overdue, scan_boost, room_bias, penalties)

Frontend
- [x] Add simple dashboard views:
  - [x] completion / checks summary (basic)
  - [ ] friction tasks list
  - [ ] completion trend summary (charting)
  - [ ] tunables editor (guarded; defaults to “advanced”)

Exit criteria: you can see what’s working, tune weights, and understand why tasks are being dealt.

---

## Development Commands

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install fastapi uvicorn pydantic
export CHORE_VAULT_PATH="/path/to/vault/chore_system"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Frontend
cd frontend
npm install
npm run dev  # with proxy to localhost:8000

# LAN access (trusted network only)
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
