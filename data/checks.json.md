# Reference: checks.json

The `checks.json` file defines the "Scan" prompts that appear when you enter a room.

| Field | Type | Description |
| :--- | :--- | :--- |
| `schema_version` | integer | Currently `1`. |
| `checks` | array | List of check objects (see below). |

### Check Object

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | string | Unique identifier (e.g., `c_kitchen_sink_clean`). |
| `room` | string | ID of the room where this prompt appears. |
| `prompt` | string | The question asked during the scan. |
| `linked_task_ids` | array | List of task IDs to boost if the answer is "No". |

### Example

```json
{
  "schema_version": 1,
  "checks": [
    {
      "id": "c_cats_litter_clean",
      "room": "cats",
      "prompt": "Is the cat litter clean?",
      "linked_task_ids": ["t_cats_clean_toilets"]
    }
  ]
}
```
