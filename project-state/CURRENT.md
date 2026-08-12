# Housepage Projection — Current State

© 2026 Mikhail Shakhnazarov. All rights reserved.

**Branch:** `projection/full-product-python`  
**Base authority:** `master` at projection creation  
**Status:** active forming object; not release-ready

## Object

Reimplement Housepage around the household ritual `Scan → Deal → Act` as the product core. Notes, expenses, decisions, invitations, shared coordination and vault compatibility remain possible product capabilities, but they are subordinate to whether the ritual reliably reduces remembering, choosing and negotiation work in ordinary life.

The projection is Python-first. The existing Rust/Vite and Next.js/Postgres editions remain evidence: their event model, scan ontology, dealing logic, storage behavior and household coordination semantics are inputs to reconstruction rather than implementation topology that must be preserved.

## Current implementation direction

A new Python semantic/runtime surface will define rooms, checks, tasks, observations, energy/time constraints, deal selection, action events, replay and portable storage contracts. UI and delivery adapters must consume these contracts rather than own them.

## Immediate work

Implement the canonical Python ritual engine, versioned event/state schemas, deterministic dealing fixtures, replay, household scoping and a local delivery surface. Only then extend multi-user coordination and bridge behavior without contaminating the core ritual.

## State discipline

Development state, decisions, discarded alternatives, field evidence, readiness records and Rust-rewrite correspondence live exclusively under `project-state/` and do not appear on the household-facing product surface.
