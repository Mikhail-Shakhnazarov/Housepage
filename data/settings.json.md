# Reference: settings.json

The `settings.json` file defines the global configuration for the chore system, including available rooms and baseline dealer constraints.

| Field | Type | Description |
| :--- | :--- | :--- |
| `schema_version` | integer | Currently `1`. |
| `defaults` | object | Global constraints for the "Deal" algorithm. |
| `rooms` | array | List of room objects `{ "id": string, "label": string }`. |

### Defaults (`defaults`)

| Field | Type | Description |
| :--- | :--- | :--- |
| `hand_size` | integer | Number of tasks dealt per session (default `3`). |
| `scan_first` | boolean | If `true`, the UI forces a room scan before dealing. |
| `time_buckets_min` | array | List of integers representing selectable time windows. |
| `energy_scale` | string | Description of the energy scale (e.g., `"1-5"`). |

### Example

```json
{
  "schema_version": 1,
  "defaults": {
    "hand_size": 3,
    "scan_first": true,
    "time_buckets_min": [5, 10, 20, 45, 90],
    "energy_scale": "1-5"
  },
  "rooms": [
    { "id": "kitchen", "label": "Kitchen" },
    { "id": "cats", "label": "Cats" }
  ]
}
```
