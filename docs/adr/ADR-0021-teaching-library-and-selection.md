# ADR-0021 — Keyed teaching library and misconception-aware selection

- **Status:** Accepted (implementation decision, reversible) — 2026-10-17.
  Implemented: `@potenova/curriculum/lessons` (schema + authored DRAFT seed +
  `selectLesson`), `services/api` route `GET /learners/:alias/lessons/:skillId`,
  and the `apps/web` learner "Learn it" hub. Shipped in PR #12.
- **Date:** 2026-10-17
- **Deciders:** Curriculum / AI Governance (owner: Cristian Miron)
- **Requirement IDs:** AI-001 (content gate — LOCKED), LRN-007 (misconception →
  remediation KB), coaching-only non-negotiable, mastery-stays-derived
  non-negotiable
- **Decision class:** IMPLEMENTATION DECISION
- **Relates to:** ADR-0006 (model validation and fallback), ADR-0003 (curriculum
  knowledge graph); project doc `claude/Teaching_Library_Decision_LRN.md`; G2
  gate (curriculum + child-safety review)

## Context

The "Learn it" / step-by-step category initially shipped as a single hardcoded
worked example in the web client. The product question was whether teaching
content should be AI-generated per child from their progress/weaknesses, or
generic. Two concerns had been conflated: _generating_ content and
_personalising which content a child sees_. They are independent, and the
content gate (AI-001, LOCKED) forecloses one of them — no generated or free-form
content may reach a child without an independent validator PASS, else serve an
approved fallback or disable, fail-closed. Separately, we already capture the
signal needed to personalise selection: the coaching ladder tags each wrong
answer with a `misconceptionId` (LRN-007), and representation diversity is a
tracked projection signal.

## Decision (reversible)

**Personalise by selection over an authored, approved library — never by live
generation.**

- **Content is authored and independently approved**, like the coaching-hints
  KB; it is an approved asset, not a free-form tutor turn. AI may draft
  candidates upstream, offline, but only validated + reviewed entries become
  eligible to reach a child. Generated-then-validated-then-served is allowed;
  generated-live-to-child is barred.
- **Schema: `Lesson` keyed by `(skillId, misconceptionId, representation)`**,
  where `misconceptionId`/`representation` may be `ANY` (a skill default). Lesson
  bodies are **structured steps** (`say` | `bars`), not raw markup, so the
  renderer draws them safely and each field stays reviewable. A lesson is
  servable only when `approved` **and** carrying a signed `approvalRef` —
  mirroring the content gate's PASS-needs-a-signed-record rule.
- **Selection: `selectLesson(skillId, misconceptionId?, representation?)`**
  returns the most specific _servable_ match (matched misconception outranks
  matched representation), never returns a lesson authored for a _different_
  misconception, breaks ties deterministically, and returns `null` when nothing
  qualifies.
- **Delivery: `GET /learners/:alias/lessons/:skillId`** — child-actor,
  consent-fenced, region-checked; re-checks approved+signed before serving;
  returns `{lesson: null}` rather than anything unvetted. The UI selects by the
  misconception from the child's **last hint**, falling back to the skill
  default, and to a static client example only if the fetch fails.

## The hard governance boundary

The library is authored content serving the role of the content gate's approved
assets. Nothing on this path is generated for the child at request time, so the
gate holds by construction. The bar that makes a lesson "approved" for a **real**
child is EVIDENCE REQUIRED — an owner-gated decision taken at G2 alongside the
curriculum and child-safety reviews. The seeded library is authored DRAFT
content for synthetic Stage-2 only; its `approvalRef`
(`AUTHORED-DRAFT-0.1(ER-CONTENT-UNCALIBRATED)`) marks it as uncalibrated, and no
real child sees any of it before G2. Mastery is never set on this path; the
screen only reads projections back.

## Alternatives considered

- **Live per-child generation.** Rejected: violates AI-001, and adds
  hallucination, inconsistent method, tone/safety drift, latency and cost, with
  no pre-validated text to gate on.
- **Fully generic (one explanation per skill).** Rejected as the end state: it
  discards the misconception signal already captured and teaches every child the
  same way regardless of where they are stuck. It survives only as the `ANY`
  default within the keyed library and the client's offline fallback.

## Consequences

- Personalisation reuses the existing evidence/selection seam; adding breadth
  (more lessons, more misconception/representation keys) needs no new mechanism.
- Content stays reviewable and gate-compatible field-by-field.
- Current limit: the misconception is the one the client observed in the last
  hint; server-side derivation from recent evidence, and per-representation
  targeting, are follow-ups that do not change the selection seam.

## Reversal triggers

- The content pipeline gains a validated, gated generation path approved for
  child delivery → the library becomes one source among several behind the same
  gate, selection unchanged.
- Curriculum review restructures misconception/representation taxonomy → re-key
  the library; the schema and selector are unaffected.
