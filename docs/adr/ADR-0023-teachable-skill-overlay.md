# ADR-0023 — Teachable-skill overlay over the Ontario catalogue

- Status: Accepted (DRAFT layer; content is educator-review-gated)
- Date: 2026-10-18
- Owner: Product / Curriculum
- Related: ADR-0021 (teaching library & selection), ADR-0022 (full G1–8 catalogue scope),
  requirements ER-03, NFR-07, NFR-08, NFR-10; Master §12 (AI proposes, never alters canonical);
  TM-42/43.

## Context

The source-verified Ontario catalogue (ADR-0022) is on `main`: 849 specific expectations
across G1–8 in both subjects, each with its real Ontario `sourceCode`, all at
`reviewStatus: 'draft'`. The catalogue is reference data — it is not, by itself, something a
learner is coached against. Between the catalogue and the adaptive engine we need a layer that
answers two questions:

1. which **teachable (coachable) skills** does each official expectation require, and
2. how do those skills **depend on one another** (the prerequisite graph the diagnostic and
   remediation loop traverse)?

Those are pedagogical judgements. Under the project's non-negotiables, AI may _propose_
relationships but must never alter the canonical graph, and mastery must stay derived from
immutable evidence — the overlay must not become a backdoor for either.

## Decision

Introduce a **teachable-skill overlay** (`@potenova/curriculum` → `overlay/`) as an explicit
**proposal layer**, with these properties:

- **Expectation → skill links are unsigned.** Each link (`ProposedSkillMapping`) carries
  `reviewedBy: null` and a `rationale` for the reviewer. `validateOverlay` fail-closes if any
  link is pre-signed, references an expectation not in the catalogue, references an unknown
  skill, or has an id inconsistent with its subject/grade/code. An unsigned link is never
  presented as validated coverage (it mirrors `ExpectationSkillMap.reviewedBy`).
- **Prerequisite edges are proposed, never canonical.** `buildProposedOverlayGraph` seeds edges
  via `CurriculumGraph.proposeDependency`, so canonical traversal ignores them until a
  review-controlled `approveDependency` promotes each one. The proposed graph is asserted
  acyclic at build.
- **No mastery data.** The overlay sets no thresholds, evidence weights, or benchmarks. Those
  are ER-03/NFR-07/NFR-08 decisions owned by the independent educator review and live nowhere
  in this module.
- **Anchored to real codes.** Links reference catalogue expectation ids
  (`EXP-ONT-<SUBJECT>-G<grade>-<code>`), replacing the placeholder
  `DRAFT-PENDING-CURRICULUM-REVIEW` codes used by the earlier `fractions-draft` fixture.

## Scope

Seeded with the **fractions pilot path only**, anchored to the real Ontario Math (2020) codes
(e.g. G1 B1.6/B1.7/B1.8, G3 B2.8, G4 B1.4/B1.5/B1.9/B2.7, G5 B1.3/B1.4, G7 B1.4). This is the
mechanism plus one worked example, not full coverage. `overlayCoverage()` reports, per
subject/grade, how many expectations have ≥1 DRAFT link — today most (all of language) are
zero, which is the honest state for NFR-10 tracking.

The remaining expectations are mapped under the educator gate, grade/strand by grade/strand.
The next build on this seam is **item generation** (expectation/skill → practice items), which
is a separate layer and still runs every generated item through the content gate before any
reaches a child.

## Consequences

- The educator review (see `Curriculum_Educator_Review_Brief`) now has a concrete, real-code
  overlay to confirm or correct for item 1(b) — "does the skill overlay map correctly?".
- Nothing here changes a learner's path or mastery: edges are proposed, links are unsigned, no
  real model is wired, synthetic data only until G2.
- `fractions-draft` remains as the skill/edge/misconception source for the pilot; the overlay
  reuses its `FRACTION_SKILLS`/`FRACTION_DEPENDENCIES` and supplies the real-code anchoring the
  fixture lacked.
