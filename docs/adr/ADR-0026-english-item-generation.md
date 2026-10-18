# ADR-0026 — English item generation (rule-decidable morphology)

- Status: Accepted (DRAFT / synthetic-only; no real model)
- Date: 2026-10-18
- Owner: Product / Content
- Related: ADR-0006 (content validation & oracle), ADR-0024 (item-generation layer),
  ADR-0025 (fraction oracle kinds); requirements AI-001, CONT-001/003, NFR-07, AT-20; TM-10.
  Master scope: Math/English coaching only.

## Context

Item generation (ADR-0024/0025) covered the full fractions pilot but English had a single
oracle kind — regular noun plurals — and no generator. To bring English onto the same path we
need more deterministic oracle kinds and an English generator, without crossing into content
that is not rule-decidable.

The hard constraint for English: correctness must be mechanically decidable so the key can be
validated and a learner answer graded **without a model** (AI-001). That rules out open-response
reading comprehension and composition — those need a model behind the same gate, later. It
admits **rule-based regular morphology**, where a single correct form follows from a rule.

## Decision

- **Two new oracle kinds** in `@potenova/content/english-check`, each pure rule arithmetic over
  lowercase words:
  - `regular_past_tense` — `pastTenseRegular` (walk→walked, play→played, hope→hoped,
    stop→stopped, carry→carried).
  - `comparative_adjective` — `comparativeRegular` (tall→taller, slow→slower, nice→nicer,
    big→bigger, happy→happier).
    `checkEnglishTask` becomes a `switch` with an exhaustiveness guard; regular plurals are
    unchanged.
- **Two DRAFT skills** added to `english-draft`: `SK-EN-past-regular`, `SK-EN-comparative`
  (unsigned fixture skills, like the existing plural skills).
- **An English generator** (`english-item-generator.ts`) parallel to the fractions one. It
  draws from **curated regular word pools** (tiered intro/core/stretch), computes keys with the
  rule oracle, and gates every item through the same independent validator + LOCKED
  content-gate. The deterministic result rides the validation `math` slot — the subject-neutral
  "oracle ran + correct" signal the task bank already uses. `validatorId` must differ from the
  generator (TM-10); a wrong key FAILs → BLOCK (AT-20), fail-closed.

## Scope and non-scope

In: regular plurals (base / sibilant), regular past tense, regular comparative — closed,
single-answer, rule-decidable. Pools contain only rule-regular words; **irregulars**
(child→children, go→went, good→better) and multi-syllable doubling exceptions are excluded —
they need a reviewed lexicon, not a rule, and must never enter the pools. Open-response
reading/writing is explicitly out: not rule-decidable, deferred to a model-backed generator
behind the same gate.

## Consequences

- Both subjects now generate validated item streams on one pattern, so the diagnostic/coaching
  loop and the educator's sample-item request work for English too.
- Correctness stays exact and model-free; these are the checks NFR-07/NFR-08 measure against,
  with no thresholds set here.
- Counts are capped by the curated pool size at a difficulty (never padded with nonsense) —
  expanding a skill's reach means adding reviewed words, not loosening the rule.
