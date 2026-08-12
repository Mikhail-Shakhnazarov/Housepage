# Housepage Projection — Rust Correspondence Map

© 2026 Mikhail Shakhnazarov. All rights reserved.

| Python surface | Rust target | Contract that must survive |
|---|---|---|
| `core.Check` / `Task` / `Event` | serde structs/enums | field names, nullability, timezone-aware timestamps, answer/action vocabularies |
| `DealRequest` / `Tunables` | validated structs | numeric ranges, named algorithm version |
| signal derivation | pure functions | skip window/cooldown, scan window/decay, last-action selection |
| `deal_tasks` | pure deal module | eligibility, score components, deterministic tie-breaking, reason codes |
| `storage.SQLiteHouseholdStore` | `rusqlite` adapter | schema version, append event order, portable bundle round-trip |
| bundle JSON | serde schema | rooms/checks/tasks/events and exact IDs/timestamps |
| future household auth | explicit policy module | membership/isolation decisions independent of HTTP framework |
| future local UI/server | replaceable adapter | ritual states and commands only; no domain rules in presentation |

## Rewrite-debt alarms

- No Python/JavaScript UI state may become the authoritative Scan → Deal → Act state machine.
- SQLite row IDs cannot replace durable household IDs.
- Definition history/hash-precondition behavior must be specified before it is implemented differently by Python and Rust editions.
- Time and floating-point scoring require conformance vectors before algorithm changes are admitted.
