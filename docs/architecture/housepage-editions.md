# Housepage Architecture: Editions and Migration

## Context

Housepage exists in two states:

1. **Local-vault baseline** (Rust/Axum backend, Vite/React frontend): local-first storage (JSON in Obsidian vault), built around the scan-first "dealt hand" ritual.
2. **WG webapp** (Next.js/Prisma/Postgres): multi-user coordination with notes, expenses, decisions, and scan persistence.

## Current state (Phase 2: Kernel porting)

Both surfaces run independently. The webapp now implements the full scan-first loop as its primary dashboard action.

What has been ported to the webapp:
- Scan ontology schema (rooms, checks, tasks, scan sessions, deals, task actions) in Postgres
- Seed scripts that populate webapp data from `vault_sample/chore_system/`
- Dealing logic ported as a TypeScript score-and-select function with unit tests
- Dashboard with scan loop UI (room picker, prompts, energy/time, dealt hand, done/skip)
- Route-level input validation (energy 1-5, timeMin 1-480, handSize 1-20, answer yes/no)
- API endpoints: scan submit, deal, task action, activity feed, metrics
- Invitation token flow with role validation
- Feed auto-refresh after scan/deal/action mutations

What remains in the local-vault baseline only:
- The original Rust dealing engine with full event-replay scoring
- File-based storage with Obsidian integration
- Hash-precondition writeback for definitions

## Migration plan

### Remaining Phase 2 work
- Add a "Sovereignty Bridge" for one-directional export from webapp to local JSON/NDJSON format

### Phase 3: Retirement
- Once webapp matches local-vault functional parity, retire the original Vite frontend
- Keep the Rust backend available as an optional compute engine
- Export bridge becomes bidirectional

## What not to assume yet

- The two scan ontologies are not synced. Changes in the vault do not propagate to the webapp and vice versa.
- The dealing logic in TypeScript is a simplified version of the Rust scoring engine. It does not include the full event-replay derivation.
- The Sovereignty Bridge does not exist yet. Data in the webapp cannot be exported to the local vault format without a manual migration script.
- The local-vault baseline is not deprecated and will not be retired until functional parity is demonstrated in production use.
