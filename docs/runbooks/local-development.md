# Local Development Runbook

## Rust/Vite baseline

### Start

```bash
export CHORE_VAULT_PATH="$PWD/vault_sample/chore_system"
make dev
```

This runs `cargo run` in `backend-rs/` and `npm run dev` in `frontend/` concurrently.

The backend listens on `http://0.0.0.0:8000`. The frontend dev server listens on `http://localhost:5173` and proxies API requests to the backend.

### Build only (no dev server)

```bash
make build-rs    # cargo build --release in backend-rs/
make build-fe    # npm run build in frontend/
```

### Expected output

```
Starting Housepage (Rust Backend)...
listening on 0.0.0.0:8000

VITE v6.2.x  ready in XXXms
  ➜  Local:   http://localhost:5173/
```

### Troubleshooting

| Symptom | Check |
|---------|-------|
| Backend fails to start | Is `CHORE_VAULT_PATH` set to a valid `chore_system/` directory? |
| Frontend shows blank page | Open browser dev tools — check for CORS or proxy errors |
| `cargo build` fails | Run `rustup update` and check Rust version (MSRV not pinned, stable should work) |
| Port 8000 in use | Set `CHORE_PORT=8001` to use a different port |
| Frontend can't reach backend | The Vite proxy expects the backend on port 8000. Check `frontend/vite.config.ts` |

## Webapp

### Start

```bash
cd webapp
cp .env.example .env    # first time only
npm install              # first time only
npx prisma generate      # after schema changes
npx prisma migrate dev   # first time or after schema changes
npm run dev
```

Opens `http://localhost:3000`.

### Full CI-equivalent run

```bash
cd webapp
npm install
npx prisma generate
npx prisma migrate dev
npm run seed
npm run db:seed:scan
npm run db:validate:scan
npm run lint
npm run build
npm run smoke
npm run smoke:access
npm run smoke:webapp
```

### Expected output

After seed:

```
Users: Alice, Bob, Clara, Dave
Household: Sonnenallee 42
Memberships: Alice (OWNER), Bob (MEMBER), Clara (MEMBER), Dave (SUBLET)
Tasks: 6 created
Expenses: 4 created with splits
Notes: 4 created
Decisions: 2 created
Feed events: 7 created
Seed complete.
```

After scan seed:

```
=== Scan Sample Seed ===
Read 10 rooms, 120 tasks, 42 checks, 73 events
Rooms: 10 upserted
Tasks: 120 upserted
Checks: 42 upserted
Check-task links: 87 upserted
```

After validation:

```
rooms: 10
checks: 42
tasks: 120
check-task links: 87
scan data ok
```

### Reset local database

```bash
cd webapp
npx prisma migrate reset --force
npx prisma migrate dev
npm run seed
npm run db:seed:scan
npm run db:validate:scan
```

This drops all data and re-creates it from scratch.

### Reseed sample data only

```bash
npm run db:seed:scan   # re-seeds scan ontology
npm run db:validate:scan
```

Rerunning the seed script upserts data by unique keys (household ID + slug/sourceKey). It is safe to run multiple times.

### Troubleshooting

| Symptom | Check |
|---------|-------|
| `Can't reach database server` | Is Postgres running? Is `DATABASE_URL` correct in `.env`? |
| `Relation "public.User" does not exist` | Run `npx prisma migrate dev` to apply migrations |
| `npm run seed` fails with unique constraint | Run `npx prisma migrate reset --force` first, then re-seed |
| `npm run build` fails with type errors | Run `npx prisma generate` first to regenerate client types |
| Port 3000 in use | Next.js will prompt to use a different port — press `y` |
| Auth loop in browser | Clear cookies and localStorage for localhost:3000, then sign in again |

## Justfile commands

The project includes a `justfile` with convenience commands (requires `just`):

```bash
just db-start          # Start local Postgres (if managed by just)
just db-stop           # Stop local Postgres
just db-init           # Initialize database
just dev               # Start webapp + Rust backend concurrently
just install           # npm install + cargo build
just clean             # Remove .db/, webapp/.next/, webapp/node_modules/, backend-rs/target/
```

## CI-equivalent commands

```bash
# Full local CI run
make build-rs
make build-fe
cd webapp
npx prisma generate
npx prisma migrate dev
npm run seed
npm run db:seed:scan
npm run db:validate:scan
npm run lint
npm run build
npm run smoke
npm run smoke:access
npm run smoke:webapp
```

## Common environment issues

- **Windows**: The Makefile and scripts assume a Unix-like environment. Use WSL2 for the Rust/Vite baseline. The webapp can run natively on Windows in PowerShell.
- **Postgres on macOS**: `brew install postgresql@16 && brew services start postgresql@16`
- **Postgres on Linux**: `sudo apt install postgresql && sudo systemctl start postgresql`
