# ADR-0047 — Data-driven teachable-skill strands

- Status: Accepted — 2026-10-22 (Cristian Miron). DRAFT content only; every strand stays
  `reviewStatus: 'draft'` until the educator gate signs it (ER-03 / NFR-10).
- Date: 2026-10-22
- Deciders: Engineering (curriculum/WP-02)
- Related: ADR-0022 (Ontario catalogue as data), ADR-0023 (teachable-skill overlay),
  LRN-007/008, NFR-10 (G1–8 coverage), Master §12 / TM-42/43 (AI proposes, never mutates
  canonical).
- Decision class: IMPLEMENTATION DECISION (reversible — the loader produces the same domain
  entities the hand-authored fixtures did).

## Context

The teachable-skill strands the engine coaches (fractions, whole-number addition, English word
formation) were authored as hand-written TypeScript: each `*-draft.ts` built arrays of
`CanonicalSkill` / `SkillDependency` / `MisconceptionDefinition` / `InstructionalStrategy` inline.
That does not scale to the full Ontario G1–8 scope (NFR-10) — adding a strand or grade slice meant
writing more code, and the structural invariants (unique ids, edges referencing known skills, an
acyclic prerequisite graph) were re-checked ad hoc per fixture. The source-verified Ontario
expectation catalogue was already data (ADR-0022, JSON under `ontario/data`); the teachable-skill
layer was not.

## Decision

- **Represent each strand as a `StrandDataset`** (compact JSON under
  `packages/curriculum/src/strands/data/*.json`): `skills`, `dependencies`, `misconceptions`,
  `strategies`, plus a `version`, `domain` and `reviewStatus`. Adding or extending a strand is
  editing a data file — no new per-strand TypeScript.
- **One shared loader/validator** (`strands/schema.ts`):
  - `validateStrandData` throws on any structural problem — missing header fields, duplicate ids,
    edges/misconceptions referencing unknown skills, self-edges, bad edge type/weight, dangling
    remediation-strategy references, or a cyclic prerequisite graph — so malformed data fails the
    build/tests, never the engine.
  - `loadStrand` stamps the cross-cutting fields the hand-authored builders used to set inline
    (`version`, `status:'active'`, `approvalStatus:'approved'`, `approvalVersion`) from the
    dataset, yielding byte-identical entities.
  - `buildStrandGraph` seeds a `CurriculumGraph` from a dataset. Edges seed as `approved` because a
    strand dataset is the reviewed DRAFT baseline for its slice — exactly as the previous fixtures
    did. An AI/candidate edge still goes through `CurriculumGraph.proposeDependency` and never
    comes from a dataset (Master §12 preserved).
- **Preserve the public API.** `fractions-draft.ts` / `addition-draft.ts` / `english-draft.ts` now
  load their strand and re-export the same named consts (`FRACTION_SKILLS`, `buildFractionsDraftGraph`,
  …). The overlay, adaptive engine and every existing test are unchanged.

## Consequences

- Strands scale by data: the G1–8 backlog is authored as JSON under the educator gate, not code.
- Structural correctness is enforced once, at load, for every strand (incl. acyclicity).
- No governance change: this is a representation refactor. Datasets remain DRAFT and set no mastery
  thresholds, weights beyond relative edge strength, or benchmarks — those stay the educator's
  (ER-03/NFR-07/NFR-08). A `draft` dataset must never be presented as validated coverage.
- Reversible: the loader emits the same entities, so a strand could be inlined again if ever needed.
