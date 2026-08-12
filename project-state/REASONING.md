# Housepage Projection — Reasoning Record

© 2026 Mikhail Shakhnazarov. All rights reserved.

## R-001 — Product identity

**Observation.** The repository contains a local-vault edition and a WG webapp. Both now contain the Scan → Deal → Act loop, while the WG surface also adds coordination features. Repository architecture still treats the local-vault path as authoritative for the core ritual until production parity is demonstrated.

**Inference.** The common differentiated object is the ritual, not either delivery stack. Treating the webapp as the product would naturalize Postgres/auth/notes/expenses decisions before proving the household interaction that motivated the system.

**Decision.** Reimplement the ritual as an independent Python semantic core and make editions adapters around it.

**Falsifier.** If repeated household use shows that the ritual has no value without shared coordination features, the product boundary must expand and this decision should be revised.

## R-002 — Dealing as inspectable consequence

**Observation.** Existing implementations score/select tasks from room observations, energy, time and retained event history, but current editions do not share one canonical executable semantic contract.

**Inference.** A household product cannot safely evolve two subtly different notions of what should be dealt. Replay and explainability are more important than preserving either implementation.

**Decision.** The Python projection will own one versioned deal contract with deterministic fixtures and explicit reasons. UI language will expose consequence, not scoring internals.

## R-003 — Full-product threshold

**Observation.** A localhost scan loop can be complete as software and still fail as household infrastructure.

**Inference.** Readiness requires sustained use, setup/editing, backup/restore, migration, household isolation, recovery, accessibility and maintenance behavior.

**Decision.** No vertical-slice milestone may be called ready. Product readiness is gated by the branch contract and situated evidence.
