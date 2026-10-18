# ADR-0027 — Wire the generated item stream into the coaching/diagnostic loop

- Status: Accepted (DRAFT / synthetic-only; no real model)
- Date: 2026-10-18
- Owner: Product / Content + API
- Related: ADR-0024/0025/0026 (item generation), ADR-0006 (content gate & oracle);
  requirements AI-001, AT-20/AT-27, ER-09; TM-10.

## Context

The running loop (`services/api` coaching + diagnostic routes) served items only from the
static, hand-written `TASK_BANK` — a few dozen fixed items. The deterministic item generators
(ADR-0024..0026) can produce an arbitrary validated stream per skill, but nothing in the live
loop pulled from them. The loop keys the whole task→answer round-trip by a stable `taskId`, and
`gateTask(taskId)` is its single resolve-and-gate point, so the item must be re-findable by id
at grading time.

## Decision

Make the task layer resolve **two kinds of id** through one function:

- a static `TASK_BANK` key (e.g. `frac-cmp-1`), or
- a **generated id** `gen:<skillId>:<seed>:<difficulty>:<index>`.

Because the generators are seeded and pure, a generated id fully determines its item, so
`resolveTask` reconstructs the exact item for grading with **no stored state** — the round-trip
stays keyed by id exactly as before. `gateTask` now resolves first and gates the resolved task,
so both the coaching `/task` + `/answer` paths and the diagnostic path (which already routed
through `gateTask`) accept generated ids unchanged, and every delivered item still passes the
independent-oracle + LOCKED content-gate (AT-20; the generator identity stays distinct from the
validator, TM-10).

Delivery by skill: the coaching `/task` endpoint accepts a `skillId` (plus `n` stream index and
optional `difficulty`) and serves the next generated item for that skill, with the stream
**seeded from the session id** (`seedFromSession`) so it is reproducible and graded without
persistence. A specific `taskId` still works.

## Scope

Only skills the loop can already present and grade, bound to an existing session course, are
servable from the generated stream today (`GEN_SERVABLE`): fraction comparison, fraction
equivalence, and the two regular-plural skills. Other generatable skills (the remaining fraction
kinds, English past/comparative) are **refused with a clear error**, never faked, until they get
a presentation shape and a session-course binding. The static `TASK_BANK` remains for fixed
placement/seed items and transfer tasks.

## Consequences

- The app now pulls a validated, per-session, effectively unbounded item stream for the wired
  skills instead of recycling a handful — the concrete answer to "is that only N questions?".
- No safety surface changed: there is still exactly one delivery decision point, keys are still
  oracle-checked, and nothing reaches a child without PASS + a signed record. Synthetic only; no
  real model, no real child data (pre-G2).
- Grading is stateless and reproducible: an item is regenerated from its id at answer time, so a
  retried submission (AT-27) and an operator replay both reconstruct the identical task.
