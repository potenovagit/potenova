# ADR-0044 — Bounded, fallback-safe AI invocation (per-operation cost controls)

- Status: Accepted (DRAFT / synthetic-only; pre-G2, no real child data)
- Date: 2026-10-20
- Owner: AI Governance
- Related: ADR-0005/0006 (AI gateway + provider seam), ADR-0043 (usage/cost wiring);
  AI-015 (per-operation cost controls terminate accidental loops, bounded + idempotent
  retries, never strand a child), AI-006 (safe educational fallback), OPS-002 (fail-closed).

## Context

A candidate provider call was one-shot: `provider.generate` was awaited directly, so a transient
blip threw `DEPENDENCY_UNAVAILABLE` and failed the whole operation, while nothing bounded an
orchestration that might call the model repeatedly. AI-015 (LOCKED) requires per-operation cost
controls that terminate accidental loops with a safe educational fallback, retries that are
bounded and idempotent, and a guarantee that a child is never stranded mid-diagnostic.

## Decision

- **`boundedGenerate` helper** (`@potenova/ai-gateway`) wraps a single AI operation:
  - **bounded retries** — at most `maxAttempts` (DRAFT 3), and only for a TRANSIENT failure
    (`DEPENDENCY_UNAVAILABLE`); a fail-closed policy/residency error is never retried;
  - **cost ceiling** — cumulative token units are capped (`maxUnits`, DRAFT 8000) so a runaway
    response stops the operation;
  - **never throws on exhaustion** — it returns a `FALLBACK` outcome (`attempts_exhausted` /
    `unit_ceiling` / `non_retryable`) so the caller delivers a safe, pre-validated item instead of
    stalling. OK carries the result, attempts and total units.
    The limits are DRAFT, unapproved placeholders (ER-01/NFR-14), isolated in `cost.ts`.
- **Idempotence** is made easy for the caller: the operation yields exactly one outcome and reports
  total units once, so retries never double-charge or double-deliver.
- **Eval path wired** — `/operator/model-eval` and the suite runner now invoke through
  `boundedGenerate`. On `FALLBACK` the single route returns a **contained** response (HTTP 200,
  `deliveredToChild: false`, `delivery: FALLBACK`, reason codes, attempts), records usage once, and
  audits `ai_generation_fallback` — rather than a 5xx. The suite treats a bounded-out task as an
  unparsed (non-pass, contained) answer instead of aborting the run.

## Consequences

- An AI operation can no longer spin, stall, or blow cost unbounded, and a persistent model
  failure degrades to a safe non-delivery rather than an error — the mechanism that, wired into the
  child diagnostic path at G2, guarantees "never strand a child" (demonstrated here on the synthetic
  eval path: a persistently failing provider yields a contained FALLBACK, not a 5xx, in exactly the
  attempt cap, with a single usage event).
- **DRAFT limits**: the attempt cap, unit ceiling and backoff policy are unapproved placeholders —
  real values are EVIDENCE REQUIRED (unit economics / SLOs from the beta). There is no inter-attempt
  backoff delay yet (retries are immediate); a jittered backoff is a follow-on. Route-decision
  logging (AI-006) remains the other open AI-governance item. Synthetic/pre-G2.
