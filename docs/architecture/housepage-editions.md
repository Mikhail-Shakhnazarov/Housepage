# Housepage Architecture Decision: Editions and Migration

## 0. Context

Housepage currently exists in two disparate states:
1. **Original Scan-First Prototype**: Rust/Axum backend, Vite/React frontend, local-first storage (JSON in Obsidian vault). Focuses on the "dealt hand" ritual.
2. **WG Coordination Webapp**: Next.js surface, hosted Postgres, Auth.js. Focuses on social coordination (Notes, Expenses, Decisions).

## 1. The Conflict

The `webapp` provides the social domain required for Berlin WG coordination but risks becoming a generic task tracker. The original prototype has the "magic" ritual (scan-first, energy/time-based dealing) but is tied to a local file system.

## 2. Decision: Staged Migration

We will pursue **Staged Migration** to converge these two paths without losing the product's soul.

### Phase 1: Coexistence (Current State)
- The `webapp` operates as a hosted coordination shell.
- The orignal prototype remains the source of truth for the scan-first ritual.

### Phase 2: Kernel Porting
- The `webapp` will absorb the scan-first ontology (Rooms, Checks, ScanSessions, TaskActions).
- The "Dealing" logic will be ported from Rust to TypeScript (or integrated via an edge-compatible WASM bridge).
- The `webapp` dashboard will be re-centered around the scan ritual.

### Phase 3: Retirement
- Once the `webapp` matches the functional parity of the local prototype, the original Vite frontend can be retired.
- A "Sovereignty Bridge" will be added to allow WG households to export their state back to the local Obsidian/JSON format.

## 3. Rationale

- **Preserve Ritual**: The scan-first loop is Housepage's unique valueproposition.
- **Social Scalability**: Next.js/Postgres handles the concurrent multi-user state required for WG life better than local vault syncing.
- **Optionality**: Staged migration allows us to iterate on the WG shell while keeping the core logic safe in the existing Rust backend.

## 4. Immediate Action

Demote the current "generic chore list" in `webapp` to a "Library" or "Backlog" view. The main dashboard must be re-architected to prompt for a Room Scan.
