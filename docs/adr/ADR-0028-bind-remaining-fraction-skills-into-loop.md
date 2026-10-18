# ADR-0028 — Bind the remaining fraction skills into the coaching/diagnostic loop

- Status: Accepted (DRAFT / synthetic-only; no real model)
- Date: 2026-10-18
- Owner: Product / API + Content
- Related: ADR-0025 (fraction oracle kinds), ADR-0027 (generated stream in the loop);
  requirements AI-001, AT-20; TM-10.

## Context

ADR-0025/0027 gave all seven fraction pilot skills a deterministic oracle and a generated
item stream, and wired the stream into the loop — but only `SK-FR-compare` and `SK-FR-equiv`
were actually servable there (`GEN_SERVABLE`). The other five (`partition`, `unit`, `nonunit`,
`numberline`, `order`) could be generated and gated, but the live loop had no way to **present**
them to a child or **grade** a typed answer, so a generated id for them was refused.

All five already belong to the existing `fractions` course graph, so binding them needs no
session-course change.

## Decision

Give the five remaining fraction skills a presentation + grading shape in the API task layer and
make them servable from the generated stream:

- **Task variants** (`PartitionTask`, `UnitTask`, `NonUnitTask`, `NumberLineTask`, `OrderTask`),
  all `subject: 'math'`, `course: 'fractions'`, carrying only the fields the oracle needs.
- **`present` / `tokenValid` / `judge` / `answerKeyValid`** branches for each: a fraction `a/b`
  answer for partition/unit/non-unit, a step index for number-line, a comma-separated position
  list for order. Grading parses the answer and defers to the deterministic `checkMathTask`
  oracle — the `present`/`answerKeyValid`/`judge` switches are exhaustive, so the type checker
  forces every kind to be handled.
- **`GEN_SERVABLE` + resolver** extended so `/task?skillId=SK-FR-…` serves a gated generated item
  and `/answer` grades it, reconstructed deterministically from the id (ADR-0027). Every item
  still passes the independent oracle + LOCKED content-gate; a wrong key is BLOCKed (AT-20),
  generator ≠ validator (TM-10).

## Scope / non-scope

In: the five fraction skills, servable + gradable in the loop under `fractions`. The planner's
`coachableSkillIds` is left unchanged (still compare/equivalence) so diagnostic placement is
untouched — these skills are delivered via the `skillId` path, not placement; making them
planner-selectable is a separate change. English past-tense / comparative are **not** bound here:
they need new session courses (they are neither `plurals` nor a math course), which is the next
step.

## Consequences

- The whole fractions pilot path is now playable end to end in the running loop, not just two
  skills — a child can be served and graded on partitioning, naming units, building non-unit
  fractions, placing on a number line, and ordering.
- No safety surface changed: one delivery decision point, oracle-checked keys, nothing delivered
  without PASS + signed record. Synthetic only, pre-G2.
