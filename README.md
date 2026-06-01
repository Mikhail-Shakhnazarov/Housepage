# Housepage

Household work either becomes invisible until someone snaps, or it turns into a project-management dashboard that nobody looks at. Housepage is built around a three-step scan-first loop designed to keep a home habitable without making the list the point.

1. **Scan**: Walk into a room, answer a few binary prompts ("Is the sink clear?")
2. **Deal**: State your energy level and available time.
3. **Act**: Get dealt a small hand of tasks. Mark them done or skip them. The system records the signal and moves on.

## Two surfaces

This repository contains two separate surfaces under active development:

**Rust/Vite local-vault baseline** (`backend-rs/` + `frontend/`)
The scan-first system running on your local network. Stores everything as JSON files in an Obsidian vault. No database, no auth, one user. The authoritative path for the core ritual.

```bash
export CHORE_VAULT_PATH="$PWD/vault_sample/chore_system"
make dev
# opens http://localhost:5173
```

**Webapp coordination workspace** (`webapp/`)
A Next.js/Prisma/Postgres project for multi-user WG coordination. Adds notes, expenses, decisions, and scan persistence. Designed for groups sharing a flat, not a single-user loop.

```bash
cd webapp
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
# opens http://localhost:3000
```

See [`docs/architecture/housepage-editions.md`](docs/architecture/housepage-editions.md) for how these two surfaces relate and the staged migration plan.

## Data / storage

| Surface | Storage | Format |
|---------|---------|--------|
| Local-vault baseline | Obsidian vault folder | JSON definitions + append-only NDJSON event log |
| Webapp | Postgres | Relational tables via Prisma schema |

The local-vault surface is intentionally file-based and Obsidian-friendly. You can edit `tasks.json` or `checks.json` in any text editor. History is append-only `events.ndjson`.

## Quick start

### Local-vault baseline

```bash
make build-rs        # cargo build --release in backend-rs/
make build-fe        # npm run build in frontend/
export CHORE_VAULT_PATH="$PWD/vault_sample/chore_system"
make dev
```

Expected output after startup:

```
Starting Housepage (Rust Backend)...
listening on 0.0.0.0:8000

VITE v6.2.x  ready in XXXms
  ➜  Local:   http://localhost:5173/
```

### Webapp

```bash
cd webapp
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run seed
npm run db:seed:scan
npm run db:validate:scan
npm run dev
```

Expected output:

```
rooms: 10
checks: 42
tasks: 120
check-task links: 87
scan data ok
  ▲ Next.js 16.x
  - Local: http://localhost:3000
```

Test accounts: `alice@wg.local` (OWNER), `bob@wg.local`, `clara@wg.local`, `dave@wg.local` (no password required — dev auth).

### CI-equivalent checks

```bash
# Rust/Vite
make build-rs
make build-fe

# Webapp
cd webapp
npm install
npx prisma generate
npx prisma migrate dev
npm run db:seed:scan
npm run db:validate:scan
npm run lint
npm run build
npm run smoke         # scan/deal/action loop
npm run smoke:access  # household scoping
npm run smoke:webapp  # notes, expenses, decisions
```

## Limitations

- **Single-user baseline**: The Rust/Vite surface has no concept of users or sessions.
- **No production auth**: The webapp uses an email-only credentials provider. No OAuth, no password, no SSO.
- **No production deployment**: The webapp has not been deployed outside localhost. See [`docs/deployment/webapp.md`](docs/deployment/webapp.md).
- **Prototype quality**: Both surfaces work for the people who built them, but neither is hardened.
- **Windows rename semantics**: Atomic file writes on the local-vault baseline are Linux-only; Windows falls back to remove-then-rename.
- **Test coverage**: Smoke tests cover the critical paths. No unit or E2E test framework is installed.

## Architecture

- [`docs/architecture/housepage-editions.md`](docs/architecture/housepage-editions.md) — Coexistence and staged migration plan
- [`docs/technical/process_overview.md`](docs/technical/process_overview.md) — Scan flow, scoring, dealing
- [`docs/technical/storage_behavior.md`](docs/technical/storage_behavior.md) — File-based storage contract
- [`docs/runbooks/local-development.md`](docs/runbooks/local-development.md) — Local setup and troubleshooting

---

(c) 2026 Mikhail Shakhnazarov. Part of the Earmark ecosystem.
