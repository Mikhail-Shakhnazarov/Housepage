# Webapp Deployment

## Status

The webapp has not been deployed to any staging or production environment. This document captures what is known about deployment requirements and what remains untested.

## Requirements

- **Node.js**: >= 18 (tested with 22 in CI)
- **Package manager**: npm
- **Postgres**: >= 14 (tested with 16 in CI)
- **Build**: `npm run build` produces a standalone Next.js output in `webapp/.next/`

## Required environment variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Postgres connection string | `postgresql://user:pass@host:5432/housepage` |
| `AUTH_SECRET` | Auth.js signing secret (generate with `openssl rand -base64 32`) | `dev-secret-change-me-in-production` |
| `AUTH_URL` | Public URL of the app | `https://housepage.example.com` |

## First-time database setup

```bash
# Generate Prisma client
npx prisma generate

# Apply migrations
npx prisma migrate deploy

# Seed base data (optional)
npm run seed

# Seed scan ontology (optional)
npm run db:seed:scan

# Validate seed data (optional)
npm run db:validate:scan
```

Migrations are committed to the repository and should be applied with `migrate deploy`, never `migrate dev`, in production.

## Build and start

```bash
npm run build
npm start
```

## Auth secret

Generate a secret for `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

Do not reuse the development secret from `.env.example`.

## Current auth limitations

- The credentials provider accepts any email without password verification. This is development-only.
- No OAuth providers are configured.
- No email delivery is configured.
- Session strategy is JWT (no database sessions).
- There is no sign-up gating, rate limiting, or brute-force protection.

**Do not deploy with the current auth configuration to a public internet-facing service.** At minimum, configure an OAuth provider or add password verification before exposing the app.

## Recommended first deployment target

Not yet determined. Candidates:
- Fly.io (Postgres nearby, region Europe)
- Railway (simple deploy, Postgres add-on)
- Hetzner VPS + docker-compose (more control, WG-appropriate)

## Backup and export

- Database backups should use standard Postgres tooling (`pg_dump`).
- There is no export-to-vault bridge yet. Data in the webapp cannot be converted to the local-vault JSON format without a manual migration script.
- See `docs/architecture/housepage-editions.md` for the planned Sovereignty Bridge.

## What is not production-hardened

- No monitoring or alerting
- No structured logging
- No rate limiting on API routes
- No CSRF protection beyond what Next.js provides by default
- No database connection pooling configuration (Prisma's default pool of 3 may need tuning)
- No health check endpoint (the Rust baseline has `/api/health`; the webapp does not)
- No containerization (no Dockerfile)
- No CI deployment job — the webapp is built but not pushed or deployed
- SSL/TLS termination is not configured (assumes reverse proxy or platform-managed TLS)
