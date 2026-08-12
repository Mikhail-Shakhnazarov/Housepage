# Housepage Projection — Validation

© 2026 Mikhail Shakhnazarov. All rights reserved.

**Date:** 2026-08-12  
**Policy:** GitHub CI is non-authoritative during the known runner failure. Passing local sandbox validation is authoritative for the scope actually exercised.

## V-001 — Python ritual core

**Environment:** Linux sandbox, CPython 3.13.5. Target contract remains Python >=3.11.

Locally executed checks reproduced the branch-authored ritual core and exercised:

- energy/time eligibility as hard constraints;
- negative scan answers boosting linked tasks;
- recent-skip cooldown exclusion;
- deterministic deal output for identical recorded state;
- explicit `deal-v1` algorithm version in results.

**Result:** PASS.

## V-002 — Portable SQLite/event store

Locally executed checks exercised:

- explicit schema initialization;
- room/check/task persistence;
- append-ordered household events;
- timezone-aware event round-trip;
- complete bundle export into language-neutral structures;
- replacement restore into a fresh database;
- equality of definitions and events after round-trip.

**Result:** PASS.

## Not yet validated

- package installation from the GitHub branch itself (connector repository is not mounted into the sandbox);
- migration from inherited vault/webapp stores;
- definition revision history/hash-preconditions;
- local household UI;
- production household identity/isolation;
- sustained situated use.

These remain open readiness work.
