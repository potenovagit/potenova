# ADR-0002: Persistence and the immutable-evidence model

- **Status:** Proposed (for WP-00 approval gate G0)
- **Date:** 2026-10-08
- **Deciders:** Learning / Data (with Operations)
- **Requirement IDs:** LRN-003 (immutable evidence + versioned recalculation),
  Architecture invariants §1 (append-only, corrections append), State machine 3.1,
  NFR-05 (evidence integrity), NFR-REL (durability), C-08/C-09/C-10, AT-05/06/50/60
- **Decision class:** IMPLEMENTATION DECISION

## Context

Learner **evidence is immutable and append-only**; **learner state is a derived, versioned
projection** that is recomputed by shadow replay and promoted under a policy version — never
hand-mutated. We need durable, ordered, replayable evidence with strong per-family isolation
and Canadian residency, without adopting a specialised event-store product the team can't
easily operate.

## Options considered

1. **Dedicated event-store product** (e.g., a specialised event database). Pro: event sourcing
   native. Con: another system to run with Canadian-residency + DR + backup concerns; overkill
   at this stage. **Rejected for MVP.**
2. **Managed PostgreSQL (Canadian region) with an append-only `evidence_event` table
   (insert-only, no UPDATE/DELETE grants) + projection tables rebuilt by replay.** Pro: one
   well-understood, residency-friendly, backup/restore-testable store; transactional
   consistency between appending evidence and recording the DecisionRecord; row-level security
   for family isolation; append-only enforced by DB grants + triggers. Con: must build the
   replay/projection machinery ourselves (which the spec requires anyway). **Chosen.**

Object storage (uploads, exports) uses a **private, scoped, expiring-reference** bucket in the
same Canadian region (TM-28, S-04). No raw voice persisted by default (PRIV-002).

## Decision

**PostgreSQL (managed, Canada region)** as the primary transactional store. Evidence is an
**append-only event log** (insert-only privileges; corrections are new linked rows — see
`@potenova/domain-core/evidence-ledger`). `LearnerSkillState` lives in **projection tables**
produced by replay (`ProjectShadow` → `PromoteProjection`, C-09/C-10) and is never written by
tutor/parent/billing paths. Each projection row carries `projectionVersion` and policy version.

## Consequences

- Single residency-compliant store simplifies backup, restore testing, deletion orchestration
  and DR (ADR-0010).
- Replaying evidence to rebuild state is a first-class, tested operation (supports AT-50/60).
- **Reversal/revisit trigger:** evidence volume or replay latency outgrows a single Postgres;
  promote the evidence log to a partitioned/streaming store behind the same contract.

## Compliance / verification

Append-only + correction semantics are enforced in code and tested
(`evidence-ledger.test.ts`); projection write-authority is tested
(`mastery-authority.test.ts`). Durability (NFR-REL) and integrity under concurrent retries
(NFR-05) are proved by failure-injection tests in WP-03.
