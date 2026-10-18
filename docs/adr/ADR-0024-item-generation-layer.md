# ADR-0024 — Item-generation layer (deterministic, gate-every-item)

- Status: Accepted (DRAFT / synthetic-only; no real model wired)
- Date: 2026-10-18
- Owner: Product / Content
- Related: ADR-0006 (content validation & oracle), ADR-0021 (teaching library),
  ADR-0023 (teachable-skill overlay); requirements AI-001, CONT-001..007, NFR-07,
  AT-20/AT-21/AT-39; Master §4; TM-09/TM-10/TM-40.

## Context

The catalogue → overlay chain says which teachable skills a child works on, but a
skill is coached through a _stream of practice items_, not the handful of hand-written
entries in the synthetic `TASK_BANK`. We need a layer that turns one skill into many
items. This is the layer a parent's "is that only N questions?" intuition points at.

It is also the most safety-critical layer: anything it produces could reach a child, so
it sits squarely behind the LOCKED content-gate (`@potenova/domain-core/content-gate`)
and the independent validator (`@potenova/content/validation`). The non-negotiables are
absolute here: no unvalidated generated content reaches a child, a wrong Math key must
FAIL (AT-20), the validator must be independent of the generator (TM-10), and a
validator outage fails closed (AT-39).

## Decision

Add a **deterministic item generator** (`@potenova/content` → `item-generator.ts`):

- **No model.** Items are produced by exact, seeded arithmetic — reproducible from a
  seed and fully reviewable. A model-backed generator is a post-G2 change that would
  sit behind the _same_ gate; nothing about the delivery path changes when it arrives.
- **Keys computed from the oracle's ground truth**, so a well-formed generated item is
  correct by construction — yet every item is still validated **independently** before
  delivery. Trust is not a substitute for the check.
- **Gate every item.** `gateGeneratedItems` runs each item through `validateCandidate`
  (independent oracle; `generatorId !== validatorId` or it throws, TM-10) and then
  `decideDelivery`. Only `DELIVER` outcomes may reach a child; a wrong key yields
  FAIL → BLOCK (AT-20), fail-closed. There is exactly one delivery decision point and
  the generator is not it.
- **Reuse the existing machinery.** The generator does not re-implement validation,
  the gate, or the oracle — it feeds `math-check` / `validation` / `content-gate`.

## Scope

The fractions pilot skills that have a deterministic oracle today — `SK-FR-compare`
(comparison) and `SK-FR-equiv` (equivalence) — with `intro`/`core`/`stretch` difficulty
widening the fraction pool. Other overlay skills (partition, unit, non-unit,
number-line, order) are reported UNSUPPORTED rather than faked; each needs its own
oracle kind first. English item generation is a later slice on the same pattern once
its skills have oracle-checkable kinds beyond the current plural checker.

## Consequences

- A skill now expands into an arbitrary number of validated items from a seed, which is
  what the mastery model (ER-03) and the correctness benchmark (NFR-07) will draw on —
  without this layer setting any thresholds itself (it does not, and must not).
- Determinism makes generated items reproducible for synthetic validation evidence and
  for the educator review's sample items.
- Still synthetic-only, no real model, no real child data before G2; the content-gate
  invariant holds regardless of how items are produced.
