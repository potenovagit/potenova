# ADR-0006: Model-output validation and fallback

- **Status:** Proposed (for WP-00 approval gate G0)
- **Date:** 2026-10-08
- **Deciders:** AI Governance / Curriculum / Child Safety
- **Requirement IDs:** AI-001 (independent pre-delivery validation, fail to approved content),
  TM-09/10/40, AT-20/21/39/59, C-14/C-15, NFR-01/07/08
- **Decision class:** IMPLEMENTATION DECISION

## Context

No generated content or free-form tutor turn may reach a child without passing an
**independent** validator; FAIL/UNCERTAIN must fall back to approved content or disable the
capability; if the validator is unavailable, fail closed. The generating model must not be its
own validator.

## Decision

A **generate → validate → deliver** pipeline where validation is a **separate component from
generation** (different model/policy, independent routing) and, for Mathematics, backed by
**deterministic checkers** (symbolic/arithmetic verification, rubric/accepted-solution match)
rather than LLM self-grading. Verdicts are `PASS | FAIL | UNCERTAIN | UNAVAILABLE`; only a
`PASS` **with a signed validation record** delivers (enforced in
`@potenova/domain-core/content-gate`). FAIL/UNCERTAIN/UNAVAILABLE → approved fallback asset, or
BLOCK if none. Deterministic checks precede model-based safety/age checks.

## Options considered

1. Single model self-validates. **Rejected** — not independent; a hallucinated answer key
   passes its own review (TM-10).
2. Independent validator model + deterministic Math/structural checks + approved-fallback
   library. **Chosen.**

## Consequences

- Child never sees unvalidated output; validator outage degrades safely to prevalidated
  content or capability disable (AT-39).
- Requires an approved-fallback content library (seeded in WP-02/05).
- **Reversal/revisit trigger:** evaluation shows deterministic Math coverage gaps needing a
  different verification approach for specific strands.

## Compliance / verification

Delivery-gate behaviour is tested now (`content-gate.test.ts`). Adversarial generation and
answer-key-poisoning suites land in WP-05; numeric thresholds are ER-17 (NFR-07/08).
