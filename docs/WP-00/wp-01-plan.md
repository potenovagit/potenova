# WP-01 Implementation Plan — Identity, Family & Consent

**Depends on:** WP-00 (approved). **Blocks:** WP-03 (evidence/state), WP-06 (diagnostic),
WP-10/11/12. **Primary requirements:** ACC-001..013 (Identity & Family), PRIV-004 (consent),
GOV-001/003 (ownership, states). **Contracts:** C-01 CreateFamily, C-02 RecordGuardianConsent,
C-03 CreateLearner, C-04 StartChildSession, C-23 ResolveEntitlement (read-only stub).
**Acceptance journeys:** AT-01, AT-02, AT-03, AT-04, AT-24, AT-34, AT-52 + consent-revocation
negatives. **ADRs:** ADR-0008 (identity), ADR-0002 (persistence), ADR-0005/0010 (region).

> **Do not start WP-01 until the WP-00 architecture is approved** and the two WP-01 inputs below
> are resolved: the **consent purpose/modality taxonomy** (F-07) and the **age-band taxonomy**
> (F-08).

## Task breakdown (in dependency order)

| Task | Deliverable                                                                       | Requirement IDs                    | Acceptance criteria / tests                                                                                            | Evidence                 |
| ---- | --------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| T1   | FamilyAccount + Guardian identities; owner vs learning-viewer roles               | ACC-001, ACC-004, ACC-005          | A learner cannot exist without a parent-owned family; viewer cannot delete/bill/invite — role-matrix tests             | `evidence/G1/ACC-001../` |
| T2   | Parent auth: passkeys/MFA + step-up for sensitive actions (via managed IdP)       | ACC-007                            | Sensitive actions deny without valid, unexpired step-up (AT-52 elevation attempt denied + audited)                     | role/step-up test report |
| T3   | LearnerProfiles + strict sibling isolation; child PIN/picture least-priv sessions | ACC-002, ACC-003                   | Switching siblings leaks no tasks/evidence (AT-03); child session can't reach billing/export/delete (AT-24)            | isolation fixtures       |
| T4   | Child session credentials; risk-based device verification; concurrent + handoff   | ACC-008, ACC-009, ACC-010          | Resume on authorized device once, no duplicate; stolen/expired handoff denied (AT-04); no location/fingerprinting      | session tests            |
| T5   | Consent purpose/version ledger + revocation fence wiring                          | PRIV-004, C-02 (+ `consent-fence`) | No AI before consent (AT-01); revoke optional modality stops that service, core continues (AT-34)                      | consent negative tests   |
| T6   | Family-level entitlement **read** resolution (trial/none), platform-independent   | ACC-011, C-23 (read-only)          | Same entitlement resolves across web/iOS/Android; never returns a commercial prompt to a child caller                  | cross-platform test      |
| T7   | Profile lifecycle: fresh diagnostic without wipe; reset-personalization vs delete | ACC-012, ACC-013                   | New diagnostic is versioned, prior immutable evidence preserved (AT-06 precondition); preference reset ≠ mastery erase | lifecycle tests          |
| T8   | Regional identity boundary on all identity/consent writes                         | B9, SEC-002                        | Non-Canadian region write refused fail-closed (extends `config` guard)                                                 | boundary test            |
| T9   | Audit of guardian invite/accept/modify/remove to the separate security audit log  | ACC-006, SEC-004                   | Events record actor/subject/time/action/purpose/outcome, no unnecessary child content                                  | audit-integrity test     |
| T10  | WP-01 acceptance + negative suite; evidence package                               | GOV-002                            | AT-01/02/03/04/24/34/52 green; consent-revocation negatives green; requirement trace updated                           | `evidence/G1/...`        |

## Required tests & verification evidence

Unit + contract tests per module boundary; **negative/abuse tests** (cross-family IDOR
TM-02, step-up bypass TM-01/AT-52, ex-guardian revocation TM-04, session replay TM-03,
sibling contamination TM-06, consent-revocation continues-processing TM-46/AT-34). Evidence to
`/evidence/G1/<req-id>/<run-id>/` with synthetic fixtures, redacted trace, reviewer and version
stamps. Requirement-trace rerun must show WP-01 requirements covered.

## Risks & unresolved decisions (resolve before/within WP-01)

- **F-07 consent taxonomy** and **F-08 age-band taxonomy** are inputs, not outputs — define first.
- **IdP selection** (ADR-0008) and its Canadian-residency/child-flow suitability — confirm before T2.
- **Regional identity boundary** depends on the cloud/region decision (ADR-0002/0005) being accepted.
- Deletion is only _initiated_ here; full fan-out to processors/backups is **WP-11**.

## Explicitly out of scope for WP-01

Institutional SSO and full school/B2B tenancy (GOV-011); billing/payment capture and store
reconciliation (WP-12); deletion/export fan-out to third parties and backups (WP-11); any
tutoring, diagnostic, content, or child-facing AI; animated avatars, social features.
