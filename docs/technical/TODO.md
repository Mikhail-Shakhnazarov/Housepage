# Housepage TODO

## Next: Task Sequences (Dependencies)
- Define a minimal dependency model so some tasks cannot be dealt before others.
  - Example: `t_garbage_set_new_bags` must require `t_garbage_take_out` (and maybe `t_garbage_clean_bins`) first.
- Decide where dependencies live:
  - **Option A (vault):** add optional `requires_task_ids: string[]` to `tasks.json` entries.
  - **Option B (code):** keep vault tasks “pure”, define dependencies in a separate file like `rules.json`.
- Implement enforcement in the deal engine:
  - Filter candidates whose `requires_task_ids` are not satisfied in the current session state (or in derived house state).
  - If a dependency is missing, optionally surface the “blocking” task(s) as higher priority suggestions.
- Define what “satisfied” means (open question):
  - Session-only (if you didn’t take out garbage *this session*, no bags task), or
  - Recent-history (if garbage taken out within N hours/days, bags task can appear).

## State & Events (Supporting Work)
- Extend `derive` state to track task completion timestamps and/or last-known “facts” (e.g., “garbage was taken out”).
- Decide the scope of sequencing:
  - In-room only (affects tasks dealt after scan), or
  - Global (affects Library + Deal suggestions across rooms).

## UX
- In the Deal screen, show “blocked by …” when a task is excluded.
- In Library editor, add a simple “Requires” multi-select.

## Data Hygiene
- Add a small “definitions linter” command that validates:
  - all `linked_task_ids` exist
  - rooms exist
  - dependencies are acyclic (no loops)

## Further Suggestions
- **House state vs session state:** add a “house snapshot” view that summarizes last-done times per room/check/task.
- **Cooldowns + weights (stub-ready):** introduce optional `cooldown_hours` and `weight` on tasks/checks and thread through scoring.
- **Better scan ergonomics:** quick “All yes” (with explicit confirmation) + keyboard shortcuts for yes/no.
- **Room bias tuning:** make bias strength configurable in settings (and log the score breakdown for debugging).
- **Batch actions:** “Mark all dealt tasks as skipped” and “Mark done + suggest next” buttons for one-handed use.
- **Import/export:** export current vault JSON and events log for backup/sharing; import should validate and refuse partial writes.
- **Conflicts & backups UX:** surface write conflicts in Library with “Reload latest / Overwrite anyway” options and show backup path.
- **Metrics (iteration 4):** simple analytics page: tasks done/week, average time bucket vs actual, missed checks, per-room distribution.
