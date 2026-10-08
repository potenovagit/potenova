# ADR-0001: Application/platform architecture and deployable boundaries

- **Status:** Proposed (for WP-00 approval gate G0)
- **Date:** 2026-10-08
- **Deciders:** Product / Operations (architecture owner)
- **Requirement IDs:** Architecture §1 (modular-first, avoid premature microservices),
  PRD-002 (synced web/iOS/Android), OPS-002 (capability degradation), GOV-005/GOV-011
  (no premature B2B tenancy), NFR-19 (cross-platform consistency)
- **Decision class:** IMPLEMENTATION DECISION (reversible at module seams)

## Context

The baseline mandates a **modular-first architecture with selective service separation**,
server-authoritative state, synchronous flows where consistency matters and events for
significant learning/AI/safety/billing/ops transitions. Delivery is web + iOS + Android with
one family account. The team is small (venture-scale), so operational surface area must stay
low, while domain boundaries must be clean enough to (a) enforce the mastery/validation/
residency invariants and (b) extend to B2B later without a rebuild.

## Options considered

1. **Microservices per bounded domain (14 services).** Pro: strong isolation. Con: severe
   operational/observability/consistency burden for a small team; cross-domain transactions
   (evidence → projection) become distributed sagas prematurely; directly contradicts
   Architecture §1 ("avoid premature microservices"). **Rejected.**
2. **Modular monolith (single deployable, enforced internal module boundaries) + a small
   number of independently scalable workers** (AI-gateway worker, media/vision ingestion
   worker). Pro: one transactional store for evidence/projection consistency, one deploy,
   low ops; module seams map 1:1 to the spec's bounded domains and can be peeled into
   services later; workers isolate the bursty/risky paths (model calls, file processing).
   Con: requires discipline to keep module boundaries from eroding. **Chosen.**

**Language/clients:** TypeScript end-to-end — Node.js backend, **React (web)** and
**React Native / Expo (iOS, Android)** sharing the `@potenova/contracts` types and validation.
One language lets a small team share domain/validation code across server and clients and keeps
cross-platform entitlement/state logic consistent (NFR-19). Alternative (Python/Go backend +
separate native clients) was rejected for this stage on cost-of-ownership grounds; it remains
viable for compute-heavy learning services later behind the module seam.

## Decision

A **TypeScript modular monolith** (`services/api`) hosting the 14 bounded-domain modules,
plus a thin set of isolated workers for AI routing and media ingestion. Module boundaries are
explicit and import-guarded; the learner-state, safety, consent and AI-gateway modules own
their invariants as code (`@potenova/domain-core`). Clients are React (web) and React Native
(mobile) over the shared contract types.

## Consequences

- One deployable + 1–2 workers keeps ops and DR tractable for a small team.
- Domain seams are real boundaries (enforced by module structure and fitness tests), so a
  later carve-out to a service, or a B2B tenant context, is mechanical, not a rewrite.
- **Reversal/revisit trigger:** sustained scaling or isolation pressure on a specific module
  (e.g., AI gateway, evidence store) justifies promoting that module to its own service.

## Compliance / verification

Module registry test (`services/api/test/app.test.ts`) asserts the 14 modules and that **no
child-facing route exists in WP-00**. Invariant fitness tests live in `@potenova/domain-core`.
