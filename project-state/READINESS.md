# Housepage Projection — Readiness Contract

© 2026 Mikhail Shakhnazarov. All rights reserved.

`READY` means a household product that can be lived with, not a working ritual demo.

## Core ritual readiness

- Scan, Deal and Act survive repeated ordinary use over time, including low-energy periods and incomplete participation.
- The system can derive a small appropriate hand from observations, available time and energy without requiring continuous list grooming.
- Done, Skip, deferment and changed conditions remain recoverable as durable state rather than transient UI events.
- Dealing is deterministic from recorded inputs under a named algorithm version, or its controlled nondeterminism is explicitly seeded and replayable.
- The system never silently turns a stale or contradictory household model into confident action.
- A user can understand why a task appeared without learning the scoring implementation.

## Household-product readiness

- setup, room/check/task editing, household membership, invitation/revocation, backup/restore and migration are complete;
- local/private operation remains available without mandatory cloud custody;
- shared deployment has production-grade identity, household isolation, authorization, recovery and audit behavior;
- one household can export its complete state in a documented portable representation and re-enter from that export;
- accessibility, mobile use, intermittent connectivity, concurrent household action and failure recovery are pressured;
- data retention and deletion behavior are explicit and testable;
- ordinary use does not require an administrator to repair state manually.

## Behavioral readiness

Readiness requires sustained situated evidence, not smoke tests alone. The ritual must remain useful after novelty and setup work disappear. Evidence should include voluntary return, scan-to-action time, done/skip patterns, maintenance burden, disagreement/recovery and whether the system reduces remembering/coordination work.

## Python/Rust readiness

The Python implementation is the semantic reference. Canonical event/state schemas, dealing fixtures and replay tests must be language-neutral. A future Rust engine must be able to reproduce the same state transitions from the same fixtures without redesigning the ritual.

## Build gate

GitHub CI is not authoritative while the known runner problem persists. Exact local sandbox commands and results belong in `project-state/VALIDATION.md`; passing local validation counts as passed.
