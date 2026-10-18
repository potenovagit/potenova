# ADR-0030 — Make all seven fraction skills planner-selectable

- Status: Accepted (DRAFT / synthetic-only; no real model)
- Date: 2026-10-18
- Owner: Product / API + Planner
- Related: ADR-0024/0025 (fraction oracle kinds + generator), ADR-0027/0028 (generated
  stream in the loop, then servable); requirements AI-001, AT-08, AT-12, AT-57; TM-10.

## Context

ADR-0028 made the five remaining fraction skills (`partition`, `unit`, `nonunit`,
`numberline`, `order`) servable and gradable from the generated stream, but left the
planner's `coachableSkillIds` at just `equiv` + `compare`. So a child could be served those
five only by asking for them explicitly (`/task?skillId=…`); the planner's placement and
`/next` could neither route a child to them nor progress their mastery. They were generatable
and servable, but not _selectable_.

## Decision

Add all five to the `fractions` course `coachableSkillIds`, in teaching order
(`partition → unit → nonunit → numberline → equiv → compare → order`), each with generated
`default` / `practice` / `transfer` tasks (stable `gen:<skill>:<fixed-seed>:core:<index>` ids
the task layer resolves deterministically). `equiv` and `compare` keep their static bank items
(`frac-eq-*`, `frac-cmp-*`). Nothing about the generator, the oracle, or the content gate
changes — this is purely which skills the planner is allowed to act on.

A small reusable test primitive, `wrongAnswerFor(task)` (mirroring `correctAnswerFor`), returns
a valid-but-incorrect token per oracle kind, so diagnostics/tests can drive a known-wrong turn
on a generated item without hardcoded per-item answers.

## Consequences

- `/next`, diagnostic placement, stall remediation, review-due and revalidation now range over
  the full seven-skill fractions graph. A fresh learner is walked prerequisite-first down the
  real dependency chain (e.g. `compare` now has two strong prerequisites — `equiv` **and**
  `nonunit`), and mastery on any of the seven progresses through immutable evidence exactly as
  before. Mastery stays derived; the planner only reads it.
- **Attention-budget interaction (DRAFT):** a blank-slate diagnostic across all seven skills can
  reach the DRAFT `attentionBudget` (12) ceiling before every skill resolves, stopping PARTIAL
  with the deeper skills listed as explicit unknowns (never a failure label). Placement is then
  refined over subsequent sessions. The attention budget remains an EVIDENCE-REQUIRED value; this
  ADR does not change it.
- Journey/planner tests that assert the focused `equiv → compare` narrative now seed the other
  five skills as already mastered (a legitimate precondition) so that path is exercised in
  isolation; the full seven-skill walk is covered by the generated-items and diagnostic suites.
- No safety surface changed: one delivery decision point (the content gate), oracle-checked keys
  (a wrong key BLOCKs, AT-20), generator ≠ validator (TM-10), synthetic only, pre-G2. The AI
  still only _proposes_; the canonical graph and coachable set are authored, not model-mutated.
