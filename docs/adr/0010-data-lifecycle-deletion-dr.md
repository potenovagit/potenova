# ADR-0010: Data lifecycle, deletion orchestration and disaster recovery

- **Status:** Proposed — records **EVIDENCE REQUIRED** gates (ER-06, ER-07)
- **Date:** 2026-10-08
- **Deciders:** Privacy / Operations / Security
- **Requirement IDs:** PRIV-005 (orchestrated export/deletion incl. derived data),
  OPS/Architecture §7 (multi-zone + multi-region DR), NFR-13/17, TM-28/29/30/48,
  AT-33/35/45, C-25/26, DataSubjectRequest state machine 3.9
- **Decision class:** IMPLEMENTATION DECISION for mechanism; EVIDENCE REQUIRED for RTO/RPO
  (ER-06) and retention-days-by-class (ER-07)

## Context

Deletion/export must fan out across primary data, derivatives, caches, **backups** and
**third-party processors**, with tombstones so a restored backup can't resurrect deleted
learners (TM-29). DR must survive loss of a zone/region within Canada; active-active is not
required at launch. Retention durations and RTO/RPO are deliberately **unset** pending PIA and
criticality analysis.

## Decision

- **Deletion as an orchestrated job** owned by the `privacy` module, driven by a maintained
  **data-processing/lineage inventory** (every store/cache/processor registered). Completion is
  reported only after reconciliation; narrow legal exceptions are documented, not silent
  (S-08). Backups carry **tombstone/reconciliation-on-restore** controls.
- **Residency + DR topology:** primary **Canada Central**, DR **Canada East**; multi-zone for
  highest-criticality services (identity, safety, consent, evidence integrity, AI validation);
  encrypted, region-controlled, **restore-tested** backups. Active-active deferred.
- **Retention + RTO/RPO values are left UNSET** and recorded as ER-07 / ER-06, to be fixed by
  PIA/counsel and a DR exercise before G2. No invented numbers (GOV-013).

## Consequences

- Deletion correctness depends on lineage completeness — so the processing inventory is a
  first-class, reviewed artifact (PIA input), not an afterthought.
- **Reversal/revisit trigger:** criticality/BIA analysis (ER-06) or a residency change forces a
  different DR tier or topology.

## Compliance / verification

Deletion fan-out + tombstone-on-restore rehearsals and export step-up/scoping tests land in
WP-11 (AT-33/35/45). The config layer already enforces distinct Canadian primary/DR regions
(`config.test.ts`). RTO/RPO proven by the NFR-13 DR exercise before G2.
