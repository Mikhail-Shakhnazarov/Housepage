# Housepage Architecture: Editions and Migration

## Context

Housepage exists in two states:

1. **Local-vault baseline** (Rust/Axum backend, Vite/React frontend): local-first storage (JSON in Obsidian vault), built around the scan-first "dealt hand" ritual.
2. **WG webapp** (Next.js/Prisma/Postgres): multi-user coordination with notes, expenses, decisions, and scan persistence.

## Current state (Phase 1: Coexistence)

Both surfaces run independently. The local-vault baseline is the authoritative source of the scan-first ritual. The webapp operates as a hosted coordination shell with its own copy of the scan ontology seeded from the sample vault.

What has been ported to the webapp:
- Scan ontology schema (rooms, checks, tasks, scan sessions, deals, task actions) in Postgres
- Seed scripts that populate webapp data from `vault_sample/chore_system/`
- Dealing logic ported as a TypeScript score-and-select function
- Dashboard with scan loop UI (room picker, prompts, energy/time, dealt hand)

What remains in the local-vault baseline only:
- The original Rust dealing engine with full event-replay scoring
- File-based storage with Obsidian integration
- Hash-precondition writeback for definitions

## Migration plan

### Phase 2: Kernel porting
- Complete the dealing logic parity between Rust and TypeScript
- Add a "Sovereignty Bridge" for one-directional export from webapp to local JSON/NDJSON format
- Recenter webapp dashboard around scan ritual as primary action

### Phase 3: Retirement
- Once webapp matches local-vault functional parity, retire the original Vite frontend
- Keep the Rust backend available as an optional compute engine
- Export bridge becomes bidirectional

## What not to assume yet

- The two scan ontologies are not synced. Changes in the vault do not propagate to the webapp and vice versa.
- The dealing logic in TypeScript is a simplified version of the Rust scoring engine. It does not include the full event-replay derivation.
- The Sovereignty Bridge does not exist yet. Data in the webapp cannot be exported to the local vault format without a manual migration script.
- The local-vault baseline is not deprecated and will not be retired until functional parity is demonstrated in production use.
