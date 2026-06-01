# webapp — WG Coordination Surface

A multi-user household coordination workspace built on Next.js, Prisma, and Postgres. Designed for WG (flat-share) groups that need shared notes, expenses, decisions, and scan-first chore management.

## Problem

Group chat buries decisions, expense splits get forgotten, and chore rotas exist only in someone's head. The webapp gives a household a shared surface for the coordination work that a single-user scan loop cannot solve.

## Stack

- Next.js 16 (App Router)
- Prisma 7 (Postgres)
- Auth.js v5 (NextAuth) — credentials provider for development
- TypeScript
- Tailwind CSS v4

## Relationship to the local-vault baseline

The webapp is a separate surface that adds multi-user coordination on top of a hosted Postgres database. The Rust/Vite local-vault baseline remains the authoritative source of the scan-first ritual. The webapp has its own copy of the scan ontology (rooms, checks, tasks) seeded from the sample vault.

See [`docs/architecture/housepage-editions.md`](../docs/architecture/housepage-editions.md) for the staged migration strategy.

## Prerequisites

- Node.js >= 18
- PostgreSQL running locally

### Postgres setup

```bash
psql -U postgres -c "CREATE USER housepage WITH PASSWORD 'housepage';"
psql -U postgres -c "CREATE DATABASE housepage OWNER housepage;"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE housepage TO housepage;"
```

## Complete first-run path

```bash
cd webapp

# 1. Install dependencies
npm install

# 2. Environment
cp .env.example .env
# Edit .env if your Postgres credentials differ from the defaults

# 3. Generate Prisma client and apply migrations
npx prisma generate
npx prisma migrate dev

# 4. Seed base data (users, household, tasks, expenses, notes, decisions, feed)
npm run seed
# Expected output:
#   Users: Alice, Bob, Clara, Dave
#   Household: Sonnenallee 42
#   Memberships: Alice (OWNER), Bob (MEMBER), Clara (MEMBER), Dave (SUBLET)
#   Tasks: 6 created
#   Expenses: 4 created with splits
#   Notes: 4 created
#   Decisions: 2 created
#   Feed events: 7 created
#   Seed complete.

# 5. Seed scan ontology from local sample vault
npm run db:seed:scan
# Expected output:
#   === Scan Sample Seed ===
#   Read 10 rooms, 49 tasks, 56 checks, 35 events
#   User: alice@wg.local
#   Household: Sonnenallee 42 (seed-sonnenallee-42)
#   Rooms: 10 upserted
#   Tasks: 49 upserted
#   Checks: 56 upserted
#   Check-task links: 65 upserted
#   === Seed complete ===

# 6. Validate seeded scan data
npm run db:validate:scan
# Expected output:
#   rooms: 10
#   checks: 56
#   tasks: 55 (49 + 6 base)
#   check-task links: 65
#   scan data ok

# 7. Start dev server
npm run dev
# Expected output:
#   ▲ Next.js 16.x
#   - Local: http://localhost:3000
```

Open http://localhost:3000, sign in with any email (dev auth), create a household, and the dashboard loads.

### Test accounts (after seed)

| Email | Role | Notes |
|-------|------|-------|
| `alice@wg.local` | OWNER | Household creator |
| `bob@wg.local` | MEMBER | Standard member |
| `clara@wg.local` | MEMBER | Standard member |
| `dave@wg.local` | SUBLET | Limited role |

No password required. Auth is email-only for development.

## Available scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run smoke` | Scan/deal/action lifecycle smoke test |
| `npm run smoke:scan` | Alias for `smoke` |
| `npm run smoke:access` | Household scoping and role enforcement smoke test |
| `npm run smoke:webapp` | Notes, expenses, decisions smoke test |
| `npm run smoke:http` | HTTP-level validation (requires dev server) |
| `npm run seed` | Seed base data (users, household, tasks, expenses, notes, decisions) |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run Prisma migrations in dev mode |
| `npm run db:deploy` | Apply migrations in CI/production |
| `npm run db:seed:scan` | Seed scan ontology from local sample vault |
| `npm run db:validate:scan` | Validate scan data integrity for seed household |
| `npm run test` | Run unit tests (deal scoring, validation helpers) |
| `npm run test:watch` | Run unit tests in watch mode |

## Development auth

Auth.js v5 with a credentials provider (email-only, no password). Enter any email to sign in — a user account is created if one does not exist. Sessions use a JWT strategy with `user.id` attached.

**Not suitable for production.** No OAuth, no password verification, no SSO.

## Architecture

- **Auth**: Auth.js v5 with Prisma adapter. Session includes `user.id`.
- **Data model**: Multi-tenant via `Household` and `Membership`. All operational objects scoped to a household.
- **Scan ontology**: Rooms, checks, scan sessions, deals, and task actions stored in Postgres per household. Definitions seeded from `vault_sample/chore_system/`.
- **API**: App Router route handlers with membership checks via `requireHouseholdMember()` and `requireHouseholdOwner()`.
- **State**: Client-side `HouseholdProvider` manages active household selection, persisted in localStorage.

## Database commands

```bash
# Reset database
npx prisma migrate reset

# Apply migrations only
npx prisma migrate deploy

# Create a new migration after schema changes
npx prisma migrate dev --name describe_change

# Open Prisma Studio
npx prisma studio
```

## Common errors

| Error | Likely cause |
|-------|-------------|
| `Can't reach database server` | Postgres not running or `DATABASE_URL` is wrong |
| `Relation "public.User" does not exist` | Migrations not applied — run `npx prisma migrate dev` |
| `Invalid prisma.user.upsert()` | Environment variables not loaded — ensure `.env` exists |
| `npm run lint` reports warnings | Fix unused variables or run `npm run lint -- --fix` |

## Known limitations

- Auth is email-only with no password. Not suitable for production.
- No E2E browser tests. The app is exercised through Prisma smoke scripts and unit tests.
- No deployment to any staging or production environment. See `docs/deployment/webapp.md`.
- The webapp and local-vault baseline have parallel scan ontologies with no sync bridge yet.

## Status

- Auth: Development-only credentials provider
- Deployment: Not yet deployed outside localhost
- CI: Postgres-backed build, migration, seed, validation, smoke tests, lint (blocking), and unit tests run in CI
- Tests: Smoke scripts cover scan/deal/action, access control, notes/expenses/decisions. Unit tests cover deal scoring. HTTP smoke validates route input rejection without auth.
