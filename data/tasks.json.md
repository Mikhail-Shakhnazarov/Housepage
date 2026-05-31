# Reference: tasks.json

The `tasks.json` file is the library of all possible chores.

| Field | Type | Description |
| :--- | :--- | :--- |
| `schema_version` | integer | Currently `1`. |
| `tasks` | array | List of task objects (see below). |

### Task Object

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | string | Unique identifier (e.g., `t_kitchen_clean_sink`). |
| `title` | string | Human-readable name of the chore. |
| `room` | string | ID of the room this task belongs to. |
| `effort` | integer | Energy cost (usually 1-5). |
| `minutes_est` | integer | Estimated time to complete. |
| `frequency_days` | integer? | Optional. How often the task should ideally be done. |
| `kind` | string | Category (e.g., `clean`, `tidy`, `admin`, `restock`). |
| `notes` | string? | Optional notes or verification hints. |

### Example

```json
{
  "schema_version": 1,
  "tasks": [
    {
      "id": "t_cats_clean_toilets",
      "title": "Clean cat toilets",
      "room": "cats",
      "effort": 3,
      "minutes_est": 10,
      "frequency_days": 1,
      "kind": "clean"
    }
  ]
}
```
