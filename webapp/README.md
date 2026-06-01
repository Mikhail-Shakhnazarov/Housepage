# webapp — WG Coordination Surface (Experimental)

**Status**: Future / experimental coordination surface. Not part of the current Rust/Vite baseline.

## Stack

- Next.js (App Router)
- Prisma (Postgres)
- NextAuth (Auth.js)
- TypeScript

## Relationship to Local-Vault Baseline

The `webapp/` surface is an exploration of multi-user WG coordination (Notes, Expenses, Decisions) built on a hosted Postgres database. It is separate from the local-vault scan-first ritual in the Rust/Vite baseline.

See [`docs/architecture/housepage-editions.md`](../docs/architecture/housepage-editions.md) for the staged migration strategy.

## Local Setup

```bash
cd webapp
npm ci
# Requires DATABASE_URL in .env for build/runtime
npm run dev
```

## Known Current Status

- `npm install` — passes
- `npm run lint` — has known issues (runs as non-blocking informational step in CI)
- `npm run build` — requires `DATABASE_URL` to be set

This surface is not production-ready.
