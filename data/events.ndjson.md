# Reference: events.ndjson

`events.ndjson` is a newline-delimited JSON log. Every interaction with the system — every scan, every deal, every completed task — is appended to this file as a single JSON line.

The backend never rewrites or deletes from this file.

## Event Envelope

Every event contains a standard set of metadata fields:

| Field | Type | Description |
| :--- | :--- | :--- |
| `ts` | string | ISO 8601 timestamp (UTC or with offset). |
| `type` | string | The event type (e.g., `task_done`, `task_skip`, `scan_answer`). |
| `session_id` | string | UUID linking multiple actions in a single session. |
| `device_id` | string? | Optional identifier for the hardware used. |

## Common Event Types

### `scan_answer`
Recorded for every prompt answered in a Room Scan.

| Field | Type | Description |
| :--- | :--- | :--- |
| `room` | string | ID of the room being scanned. |
| `check_id` | string | ID of the prompt being answered. |
| `answer` | string | `"yes"` or `"no"`. |

### `task_done` or `task_skip`
Recorded when a task is completed or dismissed from a hand.

| Field | Type | Description |
| :--- | :--- | :--- |
| `task_id` | string | ID of the task. |
| `room` | string? | Room context when the action was taken. |

### `deal`
Recorded whenever a new hand of tasks is generated.

| Field | Type | Description |
| :--- | :--- | :--- |
| `room` | string | Room context. |
| `energy` | integer | Stated energy level. |
| `time_min` | integer | Stated time constraint. |
| `tasks` | array | List of task IDs dealt. |

## Example

```json
{"ts":"2026-05-31T14:45:00Z","type":"scan_answer","room":"kitchen","check_id":"c_kitchen_sink_clean","answer":"no","session_id":"..."}
{"ts":"2026-05-31T14:47:00Z","type":"task_done","task_id":"t_kitchen_clean_sink","session_id":"..."}
```
