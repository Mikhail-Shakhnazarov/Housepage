# Python → Rust Portability Policy

© 2026 Mikhail Shakhnazarov. All rights reserved.

Python is the semantic reference implementation for the Housepage projection. It is not a disposable prototype.

## Construction rules

- Household state, event records, scan answers, deal requests, task actions and algorithm versions use explicit dataclasses/enums and versioned serialized schemas.
- Deal selection is implemented as deterministic pure functions over explicit inputs wherever possible.
- Clock, randomness, persistence, identity, HTTP and notification behavior are adapters behind narrow ports.
- No ORM object is a domain object. Database schemas implement the domain contract rather than define it.
- No reflection, monkey-patching, dynamic attribute semantics or framework lifecycle behavior may carry core product rules.
- State replay from a portable event stream must produce deterministic conformance fixtures.
- Error categories and invalid transitions are data contracts, not incidental Python exceptions.
- UI state machines consume domain results and do not own household semantics.
- Dependencies require an explicit Rust correspondence or replacement note before admission.

## Rewrite gate

A Python component is mature only when its types, inputs, outputs, error surface, ordering rules and fixtures map directly to an ordinary Rust module. Any component requiring product redesign during rewrite is rewrite debt and blocks readiness.
