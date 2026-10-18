# ADR-0025 — Deterministic oracle kinds for the full fractions pilot

- Status: Accepted (DRAFT / synthetic-only; no real model)
- Date: 2026-10-18
- Owner: Product / Content
- Related: ADR-0006 (content validation & oracle), ADR-0023 (teachable-skill overlay),
  ADR-0024 (item-generation layer); requirements CONT-001/003, NFR-07, AT-20; TM-10.

## Context

The item generator (ADR-0024) could only produce items for the two fractions skills that
had a deterministic oracle — `SK-FR-compare` and `SK-FR-equiv`. The rest of the pilot skill
graph (`partition → unit → non-unit → number-line`, and `order`) returned UNSUPPORTED, so the
generator covered only part of the path a child actually follows. To cover the whole pilot,
each skill needs its own **exact, reproducible** correctness check — never a model, never
floating point (AT-20; CONT-001/003).

## Decision

Add five oracle kinds to `@potenova/content/math-check`, each a pure integer check:

- **`fraction_partition`** — a whole split into `parts` equal parts, `shaded` shaded; the named
  fraction must equal `shaded/parts` (equivalent forms accepted; `shaded > parts` is malformed).
- **`fraction_unit`** — the unit fraction for `denominator` parts is exactly `1/denominator`
  (naming, so `2/10` is _wrong_ for fifths even though equal in value).
- **`fraction_nonunit_build`** — `count` copies of `1/unitDenominator` make `count/unitDenominator`.
- **`fraction_number_line`** — `fraction` on a 0..1 line of `intervals` steps lands on tick `t`
  iff `t·q == p·intervals`; a fraction that cannot land on a tick is malformed (never "correct").
- **`fraction_order`** — `claimedOrder` is a permutation of the fraction indices; correct iff
  consecutive pairs are non-decreasing by cross-multiplication. A non-permutation is malformed.

`checkMathTask`'s exhaustiveness guard forces every new kind to be handled. The generator
(`item-generator`) gains a per-skill `buildTask` for each, so all seven pilot skills now
generate items; keys are computed from the oracle's ground truth and every item still goes
through the independent validator + content-gate unchanged (ADR-0024).

## Consequences

- The generator now covers the full fractions pilot path, so the diagnostic/coaching loop and
  the educator's sample-item request can exercise every skill, not just compare/equivalence.
- Still exact and model-free: these are the reproducible checks the correctness benchmark
  (NFR-07) and misgrading tolerance (NFR-08) will be measured against, without this layer
  setting any threshold itself.
- English and non-fraction math families remain UNSUPPORTED until they get their own oracle
  kinds — reported, never faked.
