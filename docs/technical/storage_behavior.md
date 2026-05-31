# Minimal iterative storage setup (how the app handles this)

### Iteration 0: Obsidian edits only, app only appends events

- You create/edit `tasks.json` and `checks.json` manually in Obsidian.
    
- The app/backend **never tries to “sync” definitions**; it just reads them.
    
- The only thing the app writes is `events.ndjson` (append-only).  
    This is the safest starting point and avoids write-collision with Obsidian.
    

Backend behavior in Iteration 0 (explicit):

- On each request, read `settings.json`, `tasks.json`, `checks.json` from the vault path.
    
- Append to `events.ndjson` for:
    
    - scan answers
        
    - task actions (done/skip/na)
        
    - optionally “deal” events (useful for tuning)
        
- Derive “what’s urgent” by replaying events (or caching derived state in memory).
    

Write safety:

- `events.ndjson` is written by backend only; backend uses a single writer and flushes after each append.
    
- Definitions are read-only from the app’s perspective.
    

### Iteration 1: Add UI editing, but keep atomic writes

When you’re ready, add minimal endpoints to edit tasks/checks from the web UI. Then the backend must:

- write `tasks.json` and `checks.json` via **atomic write** (write temp file → rename),
    
- preserve unknown fields,
    
- keep `schema_version` stable,
    
- never edit `events.ndjson` except append.
    

### Iteration 2: Light schema evolution

When you inevitably refine fields (effort scale, frequency semantics, new rooms):

- bump `schema_version`,
    
- add a tiny migration script (or “on load migrate in memory, on save write new version”),
    
- keep old backups (git helps here).