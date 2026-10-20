# ADR-0036 — Step-up elevations are written to the security audit log

- Status: Accepted (DRAFT / synthetic-only)
- Date: 2026-10-19
- Owner: Identity / Security
- Related: ADR-0034 (step-up re-verification), ADR-0011 (security audit log); SEC-001, AT-24/52.

## Context

ADR-0034 added step-up re-verification for sensitive guardian actions and noted step-up audit
logging as follow-on. A privileged elevation that leaves no trace is a gap in the audit story —
there would be no record of who re-verified, when, or for how long.

## Decision

`POST /auth/step-up` writes an immutable security-audit entry on every successful elevation,
via the existing `SafetyRepository.recordAudit`:

- `action: 'step_up_elevation'`, `reason: 'step_up_reverification'`, `outcome: 'EXECUTED'`
- `approver`: the guardian id that re-verified
- `object`: the guardian's `family:<id>` (or `guardian:<id>` when no family scope)
- `expiry`: the elevated window's expiry (the short step-up TTL), `at`: the elevation time

## Consequences

- Each privileged elevation is now attributable and time-bounded on the append-only audit log,
  closing the ADR-0034 follow-on. No new data surface beyond the audit entry; synthetic, pre-G2.
- Denials (`STEP_UP_REQUIRED`) are not audited here — they are routine authorization refusals,
  not privileged actions; the elevation is the event worth recording.
