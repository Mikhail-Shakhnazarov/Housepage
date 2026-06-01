# webapp — WG Coordination Surface

Multi-user WG coordination (Notes, Expenses, Decisions) built on Next.js, Prisma, and Postgres.

## Stack

- Next.js 16 (App Router)
- Prisma 7 (Postgres)
- Auth.js v5 (NextAuth) — credentials provider for development
- TypeScript
- Tailwind CSS v4

## Relationship to Local-Vault Baseline

The `webapp/` surface is an exploration of multi-user WG coordination built on a hosted Postgres database. It is separate from the local-vault scan-first ritual in the Rust/Vite baseline.

See [`docs/architecture/housepage-editions.md`](../docs/architecture/housepage-editions.md) for the staged migration strategy.

## Prerequisites

- Node.js >= 18
- PostgreSQL running locally with a `housepage` database

### Postgres setup

```bash
# Create the database user and database (adjust to your local setup)
psql -U postgres -c "CREATE USER housepage WITH PASSWORD 'housepage';"
psql -U postgres -c "CREATE DATABASE housepage OWNER housepage;"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE housepage TO housepage;"
```

## Local Setup

```bash
cd webapp

# 1. Install dependencies
npm install

# 2. Create .env from example
cp .env.example .env
# Edit .env if your Postgres credentials differ

# 3. Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate dev

# 4. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with any email, create a household, and the dashboard will load.

### Scan Ontology Setup

The webapp's scan ontology (rooms, checks, tasks, deal records) is populated from the local sample vault:

```bash
# Run migration first (creates scan ontology tables)
npx prisma migrate dev --name scan_ontology

# Seed scan definitions from vault_sample/chore_system
npm run db:seed:scan

# Validate seeded data
npm run db:validate:scan
```

Expected validation output:
```
rooms: 10
checks: 42
tasks: 120
check-task links: 87
scan data ok
```

After running `npm run seed`, the following test accounts are available:

| Email | Role |
|-------|------|
| `alice@wg.local` | OWNER |
| `bob@wg.local` | MEMBER |
| `clara@wg.local` | MEMBER |
| `dave@wg.local` | SUBLET |

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run smoke` | Run local smoke test (Prisma connectivity and basic CRUD) |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run Prisma migrations in dev mode |
| `npm run db:seed:scan` | Seed scan ontology from local sample vault (rooms, tasks, checks, links) |
| `npm run db:validate:scan` | Validate scan data integrity for the seed household |

## Development Auth

Authentication uses a credentials provider (email-only). No password or OAuth is required. Enter any email to sign in — a user account is created if one does not exist.

This is suitable for local development only. Production auth is not implemented.

## Architecture

- **Auth**: Auth.js v5 with Prisma adapter. Session includes `user.id`.
- **Data model**: Multi-tenant via `Household` and `Membership`. All operational objects (tasks, expenses, notes, decisions, feed events) are scoped to a household.
- **Scan ontology**: The webapp now stores scan-first objects — rooms, checks, scan sessions, scan answers, deals, deal tasks, and task actions — in Postgres per household. Definitions (rooms, checks, tasks with `sourceKey`) are seeded from the local sample vault.
- **API**: App Router route handlers with membership checks via `requireHouseholdMember()`.
- **State**: Client-side `HouseholdProvider` manages active household selection, persisted in localStorage.

## Known Issues

- npm run lint may report non-blocking style warnings. These are being addressed incrementally.
