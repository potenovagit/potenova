# ADR-0022 — Full Ontario G1–8 curriculum scope (both subjects)

- **Status:** Accepted (scope decision, owner-approved) — 2026-10-17.
- **Date:** 2026-10-17
- **Deciders:** Product / Curriculum (owner: Cristian Miron, GOV-001)
- **Requirement IDs:** NFR-10 (full Ontario G1–8 mapping coverage), ER-03 /
  NFR-08 (mastery thresholds + curriculum mapping, educator-reviewed), F-09
  (G1 math strand, superseded in scope)
- **Decision class:** SCOPE DECISION (deviation from the staged plan — recorded
  per the CLAUDE.md deviation protocol; owner is the approver)
- **Relates to:** ADR-0003 (curriculum knowledge graph), the G2 readiness plan
  (`G2_Readiness_Action_Plan.md` items 7, 14), `Curriculum_Educator_Review_Brief.md`

## Context

The build to date carried a deliberately narrow curriculum: DRAFT strands for
fractions (math), addition/number-sense (math) and plurals (English), none
mapped to official Ontario expectation codes. The roadmap deferred **full
Ontario Grades 1–8 mapping (NFR-10) to G4** — well past the controlled beta —
and the beta itself targeted Grades 2–5.

The product owner has changed the approach: **cover both Mathematics and
Language for the full Grades 1–8 range** as committed product scope, rather than
a few strands.

## Decision

1. **Committed curriculum scope is now full Ontario G1–8, Mathematics and
   Language.** NFR-10 moves from a G4-deferred item into the committed build.
2. **Authoritative source only.** The curriculum is built from the official
   Ontario documents — the 2020 Mathematics and 2023 Language curricula — with
   expectation codes cited. It is **not** generated from model memory; unverified
   codes/expectations are never presented as authoritative. (Sourcing the
   official content is an open logistics item — see Consequences.)
3. **DRAFT until educator sign-off, at full scope.** Everything produced is a
   source-verified DRAFT _for_ the independent educator review (ER-03 / NFR-08),
   not a substitute for it. That review's scope grows from three strands to the
   whole G1–8 graph. Mastery thresholds per skill remain EVIDENCE-REQUIRED
   (the educator's call), shipped as fail-closed placeholders.
4. **Beta cohort decision deferred.** Expanding the _curriculum build_ to G1–8
   does not by itself expand the first controlled beta (G2). Which grade range
   the first real-child-data beta covers — stay Grades 2–5 while the full graph
   is built behind the gate, or widen — is deliberately left open and decided
   later; it sizes the external reviews, so it is its own decision.
5. **Data-driven representation.** G1–8 across two subjects is authored as
   structured, source-cited data (strands → overall expectations → specific
   expectations → our skill/prerequisite overlay), loaded into the existing
   curriculum graph — not hand-coded per skill — so the graph scales and the
   mapping stays reviewable field-by-field. (Design to follow in its own ADR/PR.)

## Consequences

- **Build size.** Two subjects × eight grades × multiple strands is a large,
  staged effort — built grade-band by grade-band, subject by subject, each a
  reviewable DRAFT PR; not a single drop.
- **Review surface grows.** The educator engagement (plan item 7) and the
  curriculum portion of child-safety/accessibility reviews must now cover G1–8.
  `Curriculum_Educator_Review_Brief.md` needs its scope widened accordingly.
- **Open logistics — sourcing the official content.** The 2020 Math and 2023
  Language curricula are published on a JavaScript-rendered Ministry site
  (`dcp.edu.gov.on.ca`) that server-side fetching cannot read, and there is no
  official consolidated PDF; third-party mirrors are not authoritative. Verified
  content therefore requires one of: the official PDFs/exports supplied by the
  owner, a rendered-browser extraction, or ministry data in a machine-readable
  form. Until that lands, the graph scaffold can be built but not populated with
  real expectations.
- **Existing DRAFT strands.** Fractions / addition / plurals remain as-is until
  migrated into the data-driven representation and reconciled against the
  official codes; they stay marked DRAFT/unverified-against-source.

## What stays true

No real child data before G2; mastery stays derived from evidence and is never
set by the curriculum layer. Nothing in this ADR authorises presenting
unverified expectations as official, and none of the per-skill mastery
thresholds are decided here — they remain the educator's, as EVIDENCE REQUIRED.

## Reversal triggers

- Owner reverts to a narrower committed scope (e.g., beta-grades only, G1–8
  deferred again) → NFR-10 returns to G4; the data-driven representation still
  stands.
- The official curriculum structure changes (ministry revision) → re-extract
  from source; the representation is strand/grade-agnostic by design.
