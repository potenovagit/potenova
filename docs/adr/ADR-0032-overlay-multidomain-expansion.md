# ADR-0032 — Multi-domain teachable-skill overlay + educator coverage worksheet

- Status: Accepted (DRAFT / unsigned proposals; educator-gated)
- Date: 2026-10-18
- Owner: Product / Curriculum
- Related: ADR-0023 (teachable-skill overlay); requirements LRN-007, ER-03, NFR-07, NFR-08,
  NFR-10 (EVIDENCE REQUIRED).

## Context

ADR-0023 built the teachable-skill overlay — the proposal layer between the source-verified
Ontario catalogue and the engine — but scoped it to the fractions pilot only
(`FRACTIONS_OVERLAY`), with the module's helpers hardwired to the fraction skill set. The engine
already coaches two more skill families (addition number-facts, English word-formation) that had
no overlay to real Ontario codes, and there was no artifact to drive authoring of the remaining
~820 catalogue expectations under the educator gate.

## Decision

Generalise the overlay into a **multi-domain registry** and add the **educator coverage
worksheet**, without changing the DRAFT/unsigned governance of ADR-0023.

- **`DomainOverlay`** bundles a strand's teachable skills, its PROPOSED prerequisite edges, and
  its expectation→skill mappings. `OVERLAYS` registers three worked domains: `fractions`
  (unchanged), `addition` (`SK-NS-add-within10/20` → Math G1/G2 `B2.2`/`B2.3`/`B2.4`), and
  `english` (`SK-EN-plural-base/sibilant`, `past-regular`, `comparative` → Language
  morphology/spelling `B2.x` and parts-of-speech `B3.2`). Every new mapping is `reviewedBy: null`
  and anchored to a real catalogue code; `validateAllOverlays` checks each domain against its own
  skill set and asserts mapping ids are globally unique.
- **`buildOverlayWorksheet`** emits one row per catalogue expectation across the full G1–8
  datasets (849 rows), joined with any DRAFT proposal or marked `UNMAPPED`. A committed script
  (`scripts/build-overlay-worksheet.ts`) renders it to CSV; the educator-facing `.xlsx`
  (README + per-expectation worksheet with highlighted authoring columns + a coverage tab) is
  built from that CSV.
- Back-compat preserved: `FRACTIONS_OVERLAY`, `OVERLAY_SKILLS`, and the existing helpers keep
  their fractions defaults, so `overlayCoverage()` with no args is still the fractions pilot.
  Combined coverage is `overlayCoverage(allOverlayMappings())`.

## Governance

Nothing here is validated coverage. Every mapping is unsigned (LRN-007: an unreviewed,
AI-proposed edge can never alter a learner's path), prerequisite edges are seeded `proposed`
(never approved), and the overlay sets no mastery thresholds, weights, or benchmarks — those stay
the educator's (ER-03/NFR-07/NFR-08, EVIDENCE REQUIRED). Of 849 expectations, 25 carry a DRAFT
proposal and 824 are explicit gaps for an educator to author; the worksheet is the NFR-10
tracking artifact and the input to that human track, not a claim of coverage.

## Consequences

- The overlay now covers all three skill families the engine coaches, giving educators three
  worked examples of the intended pattern instead of one.
- The worksheet makes the remaining gap explicit and authorable grade/strand by grade/strand,
  under review, without the system inventing curriculum.
- No engine or safety surface changed: the adaptive planner still reads `fractions-draft` etc.
  directly; the overlay remains a proposal/reporting layer with no runtime authority.
