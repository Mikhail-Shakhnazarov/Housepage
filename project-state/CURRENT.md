# Housepage Projection — Current State

© 2026 Mikhail Shakhnazarov. All rights reserved.

**Branch:** `projection/full-product-python`  
**Base authority:** `master` at projection creation  
**Status:** active forming object; not release-ready

## Object

Reimplement Housepage around the household ritual `Scan → Deal → Act` as the product core. Notes, expenses, decisions, invitations, shared coordination and vault compatibility remain possible capabilities, but they are subordinate to whether the ritual reduces remembering, choosing and negotiation work in ordinary life.

The inherited Rust/Vite and Next.js/Postgres editions remain evidence. Their implementation stacks no longer define the projection's semantic authority.

## Enacted Python surface

`projection_py/` now contains:

- typed checks, tasks, events, deal requests and versioned tunables;
- event-derived last-done/last-skip/scan-pressure signals;
- deterministic `deal-v1` eligibility, scoring, tie-breaking and reason codes derived from the stronger Rust behavior;
- explicit timezone-aware event semantics;
- a SQLite household store for rooms/checks/tasks and append-ordered events;
- portable bundle export and replacement restore into a fresh store;
- a cross-language deal conformance vector bound into Python tests.

Local sandbox validation passes both the ritual core and store/bundle round-trip. See `project-state/VALIDATION.md`.

## Current boundary

The next product relations are:

- definition revision history and hash/precondition behavior so human edits cannot race silently;
- migration/conformance from both inherited editions into the canonical Python state;
- one local household-facing delivery surface that enacts the ritual without dashboard maintenance;
- household membership/isolation for shared deployment;
- backup/recovery/upgrade behavior beyond fresh-store round-trip;
- sustained situated use over low-energy and low-maintenance periods.

## Immediate work

Implement definition revision/history and migration adapters before UI expansion. The first Python interface should consume only canonical ritual/store commands and should not duplicate deal semantics in presentation code.

## State discipline

Development state, decisions, field evidence, validation and Python→Rust correspondence live exclusively under `project-state/` and do not appear on the household-facing product surface.
