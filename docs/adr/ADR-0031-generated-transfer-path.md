# ADR-0031 — Generated transfer path to TRANSFERABLE

- Status: Accepted (DRAFT / synthetic-only; no real model)
- Date: 2026-10-18
- Owner: Product / API + Content
- Related: ADR-0025 (fraction oracle kinds), ADR-0028 (bind remaining fraction skills),
  ADR-0029 (English past/comparative courses), ADR-0030 (planner-selectability);
  requirements AI-001, AT-12, AT-20; TM-10.

## Context

ADR-0028/0029 made the five remaining fraction skills and the two English courses servable
and gradable from the generated stream, and ADR-0030 made them planner-selectable. But both
ADRs flagged the same gap: a generated transfer item was graded as an ordinary turn, so a
**generated-only skill could not reach TRANSFERABLE**. The cause was twofold — the course's
"transfer" slot pointed at an ordinary `core` practice item (`gen:<skill>:<seed>:core:4`,
indistinguishable from practice), and the loop recognised a transfer turn only by membership in
the static `TRANSFER_TASKS` set, which no generated id was in. So only the static
`frac-xfer-*` / `eng-xfer-*` items (compare/equivalence, plurals, addition) ever lifted a skill
to the top standing.

## Decision

Introduce a generated transfer-probe id and teach the loop to recognise it:

- A generated id may carry a `transfer` marker in its difficulty slot
  (`gen:<skill>:<seed>:transfer:<index>`). The task layer resolves it as a **`stretch`-tier
  item** — the hardest generator tier, a genuinely different item from the `core` practice
  stream — so it is a novel context (AT-12), not a repeat.
- `isTransferTask(taskId)` is the single transfer-turn predicate: true for a static
  `TRANSFER_TASKS` id **or** a generated id carrying the `transfer` marker. The coaching answer
  route records the turn as `transfer_check` via this predicate, so a correct answer flows to the
  projection's TRANSFERABLE rule exactly as the static items do.
- Each generated-only course's `transferTask` now points at `genTransferTask(skill)`
  (the five fraction skills; English `past-tense` and `comparative`). `equiv`/`compare` and the
  plural/addition courses keep their static transfer items.

Nothing about the generators, the oracles, or the content gate changes. Every delivered transfer
item still passes the independent oracle + LOCKED content gate; a wrong key is BLOCKed (AT-20);
generator ≠ validator (TM-10).

## Consequences

- The whole generated pilot path is now playable to the top standing: a child served generated
  items for partitioning, unit/non-unit fractions, number-line placement, ordering, regular past
  tense or comparatives can be lifted to TRANSFERABLE by a correct novel-context answer — the gap
  ADR-0028/0029 recorded is closed.
- A single-skill generated course (e.g. `past-tense`) completes only once its skill is
  TRANSFERABLE when the transfer check is taken; the answer route still completes a session as
  soon as every coachable skill is INDEPENDENT, so the transfer check is offered by `/next` /
  session-start on an already-independent skill (unchanged behaviour, now reachable for generated
  skills).
- No safety surface changed: one delivery decision point, oracle-checked keys, synthetic only,
  pre-G2. The AI still only proposes; the canonical graph and the transfer wiring are authored.
