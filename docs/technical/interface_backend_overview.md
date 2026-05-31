Below is a backend + React interface design that matches your current decisions:

- **Scan-first default**
    
- **Obsidian-first storage** (vault is truth)
    
- **Iteration 0**: definitions are edited in Obsidian; app only **reads defs** + **appends events**
    

---

## Interface shape (React)

Single flow, three screens, no “mode selector”:

### Screen A: Room → Scan

- Room list (Kitchen/Bathroom/Hallway/Living/Laundry/Garbage/Supermarket/Cats).
    
- On room select, load checks for that room.
    
- Render as a fast yes/no/na list. Default selection can be “Yes” to speed scanning (or blank; your call).
    
- “Finish scan” submits all answers as one batch.
    

**Key UI behavior**

- You can allow “Finish scan” even if some prompts unanswered (treat unanswered as “skip logging”).
    
- “N/A” should be sticky (once you mark N/A, you’re signalling “stop asking me this check”, unless you later re-enable in Obsidian).
    

### Screen B: Energy + Time

- Energy (1–5) required.
    
- Time buckets required (5/10/20/45/90).
    
- “Deal tasks” button.
    

### Screen C: Hand of 3 tasks

- Shows 3 tasks.
    
- Each task: title + minutes + buttons: Done / Skip / N/A.
    
- On action, immediately request a replacement task (or just remove and reduce the hand size; replacement feels better).
    

No admin UI in iteration 0. You edit tasks/checks directly in Obsidian.

---

## Backend shape (local network)

A tiny server does four jobs:

1. Read `settings.json`, `tasks.json`, `checks.json` from a configured vault path
    
2. Append events into `events.ndjson` (single writer)
    
3. Derive current task state from the event log (overdue, scan boosts, cooldowns, disabled)
    
4. Provide “deal me 3 tasks” selection
    

### Process model

- Backend is the _only_ writer to `events.ndjson`.
    
- Backend treats `tasks.json`/`checks.json`/`settings.json` as read-only in iteration 0.
    
- Backend should reload definitions on each request (or watch files). At this scale, reload-per-request is fine and simplest.
    

### Vault layout (as assumed)

`<vault>/chore_system/`

- `settings.json`
    
- `tasks.json`
    
- `checks.json`
    
- `events.ndjson`
    

The backend just needs the full path to that folder (env var).

---

## Minimal API (Iteration 0)

### Read endpoints (definitions)

- `GET /api/settings`
    
- `GET /api/rooms` (or rooms come from settings)
    
- `GET /api/checks?room=kitchen`
    
- `GET /api/tasks` (optional; mostly backend deals tasks, but useful for debugging)
    

### Write endpoints (events only)

- `POST /api/scan/submit`
    
    - body: `{ room, answers: [{check_id, answer}] }`
        
    - backend appends one `scan_answer` event per answer (or a single batch event; either works—per-answer is simpler to replay)
        
- `POST /api/deal`
    
    - body: `{ room, energy, time_min, hand_size }`
        
    - backend appends a `deal` event (optional but useful for tuning)
        
    - returns: `{ tasks: [taskView...] }`
        
- `POST /api/task/action`
    
    - body: `{ task_id, action: "done"|"skip"|"na", context?: { room, energy, time_min } }`
        
    - backend appends `task_done` / `task_skip` / `task_na`
        
    - returns: `{ replacement_task?: taskView }` (if you do immediate refill)
        

### Optional debug endpoint

- `GET /api/state?room=kitchen`
    
    - returns derived scores for tasks (overdue, scan boost, last done, skip count). Useful while tuning.
        

---

## Derived state + selection (what the backend actually computes)

On a `deal` request, backend computes (from defs + events):

**Per task:**

- `active`: task not disabled by definition, not effectively disabled by repeated `na`
    
- `last_done_ts`
    
- `last_skip_ts`
    
- `skip_count_recent` (e.g., last 7 days)
    
- `scan_boost` for this room: derived from recent `scan_answer=no` events on linked checks, with decay
    
- `overdue_factor`: if `frequency_days` is set; otherwise 0 (task can still appear via scan boost)
    

**Filtering**

- Must fit `energy` and `time_min` (e.g., `effort <= energy` and `minutes_est <= time_min`)
    
- Exclude tasks in cooldown after a skip (e.g., skipped in last 12 hours)
    
- Exclude inactive (disabled / N/A)
    

**Scoring**  
A simple v0 score that works:

- `score = 2*overdue_factor + 3*scan_boost + comfort_boost - skip_penalty`
    
- comfort_boost can be a hardcoded list by task id or `kind` (“garbage”, “sink”, etc.)
    

**Dealing**

- Sort by score desc, take top N with a tiny variety rule (don’t take 3 from the same microcluster; v0 can ignore this)
    

This selection logic lives in one backend file so Port B can tune it easily.

---

## Storage handling rules (minimal and safe)

### Reading definitions

- Parse JSON fresh per request (or cache with mtime checks).
    
- If JSON is invalid (mid-edit in Obsidian), backend should return a clear error and keep last-known-good in memory (optional but nice).
    

### Appending events

- Use append-only writes with a single backend writer.
    
- Each event is one line of NDJSON:
    
    - `{"ts": "...", "type":"scan_answer", ...}\n`
        
- Ensure flush after write. If you ever run multi-device, this prevents “lost” events.
    

### Atomicity / corruption avoidance

- You don’t rewrite `events.ndjson`, so corruption risk is low.
    
- For definitions (iteration 1), use write-temp + rename.
    

---

## Minimal iterative setup plan

### Iteration 0 (recommended starting point)

- Backend reads defs, appends events, deals tasks.
    
- All edits to tasks/checks/settings are done in Obsidian.
    
- React UI has only Scan → Energy/Time → Tasks.
    

This gets you using the system immediately and generates real events for tuning.

### Iteration 1 (optional, later)

- Add a small “Library” UI and endpoints to edit tasks/checks.
    
- Backend writes `tasks.json`/`checks.json` atomically.
    
- Keep events append-only.
    

### Iteration 2 (quality)

- Add file-watching so UI updates when you edit definitions in Obsidian without restarting.
    
- Add a small migration mechanism when schema evolves.
    

---

## Implementation choices (backend tech)

Two sensible stacks:

**A) Node/Express**  
Good if you’re already in React tooling land; easy to serve the React build + API from one process.

**B) Python/FastAPI**  
Good if you want the whole thing to live in your Python world; still trivial to serve a built React app.

Either works. The important part is the storage contract above: _defs are files; events are NDJSON; backend is the only writer._