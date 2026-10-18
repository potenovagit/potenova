# ADR-0029 — English past-tense and comparative as servable courses

- Status: Accepted (DRAFT / synthetic-only; no real model)
- Date: 2026-10-18
- Owner: Product / API + Content
- Related: ADR-0026 (English item generation), ADR-0027/0028 (generated stream in the loop);
  requirements AI-001, AT-20; TM-10.

## Context

ADR-0026 added English generators and oracle kinds for regular past tense and comparative
adjectives, and ADR-0027/0028 wired generated items into the loop — but only skills bound to an
existing session course were servable. Past tense and comparative are neither the `plurals`
course nor a math course, so a session could not run them and `/task?skillId=SK-EN-past-regular`
had no matching course. They were the last "generatable but not servable" piece.

## Decision

Introduce two **generated-only English courses**, `past-tense` and `comparative`:

- `CourseId` gains both; `COURSES` gains an entry for each (subject `english`, the shared English
  draft graph, a single coachable skill), and `COURSES_BY_SUBJECT.english` lists them so a
  session can be pinned to either via its `strand` (exactly like the math `addition` strand).
- These courses have **no static task bank**, so their `defaultTask` / `practiceTasks` /
  `transferTask` reference **stable generated task ids** (`gen:<skill>:<fixed-seed>:core:<index>`)
  that the task layer resolves deterministically.
- The task layer gains `PastTenseTask` / `ComparativeTask` variants with `present` / `tokenValid`
  / `judge` / `answerKeyValid` branches (type-a-word answers), `GEN_SERVABLE` entries, and
  resolver mappings. Every delivered item still passes the independent oracle + LOCKED
  content-gate; a wrong key is BLOCKed (AT-20), generator ≠ validator (TM-10).

## Consequences

- A child can now run an English session on regular past tense or comparatives, served a
  validated generated item stream and graded by the rule oracle — the full English pilot is
  servable, matching the fractions pilot.
- A generated transfer item is graded as a normal turn (the static `TRANSFER_TASKS` set has no
  generated ids), so TRANSFERABLE is not reached through these courses yet — a later refinement.
- No safety surface changed; synthetic only, pre-G2. The planner's coachable set now includes one
  skill per new course, so placement/selection treat them like any single-skill strand.
