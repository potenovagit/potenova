# ADR-0008: Identity, authentication and guardian delegation

- **Status:** Proposed (for WP-00 approval gate G0)
- **Date:** 2026-10-08
- **Deciders:** Identity / Security
- **Requirement IDs:** ACC-001..013 (Identity & Family), ACC-007 (MFA/passkeys + step-up),
  ACC-003 (child PIN/picture + stronger parent auth), SEC-001 (zero-standing-access),
  TM-01/03/04/05, AT-01/02/03/24/52, C-01/03/04
- **Decision class:** IMPLEMENTATION DECISION

## Context

A parent-owned `FamilyAccount` must exist before any child access. Parents need strong auth
(MFA/passkeys) and **step-up** for sensitive actions (billing, export, deletion, guardian
grants); children get **least-privileged** PIN/picture sessions that can never reach parent
functions, even on a shared device. Guardian roles are delegated and fully audited. No precise
location or invasive fingerprinting for child device risk (ACC-008).

## Decision

Server-authoritative sessions with **short-lived, capability-scoped tokens**. Parent identities
support **passkeys (WebAuthn) + MFA**, with **step-up re-verification** required for sensitive
actions. Child sessions carry a **child-only capability set** bound to one learner and device
alias; they cannot be elevated to parent capabilities within the same client context
(ACC-003/009). Guardian role grants (owner vs learning-viewer) are explicit, time-bound where
appropriate, and audited (ACC-004/005/006). Risk-based child device verification uses
**device aliases + parent approval for unknown-device transfer**, never location or fingerprint
(ACC-008).

Use a **managed identity provider** for primary auth/passkey/MFA plumbing (reversible behind
the `identity` module) rather than hand-rolling credential storage; the family/role/consent
model and all authorization decisions stay in our `identity`/`privacy` modules.

## Options considered

1. Hand-rolled auth. **Rejected** — credential-handling risk for a small team.
2. Managed IdP for auth primitives + our own family/role/consent authority. **Chosen.**

## Consequences

- Authorization (who may do what to which learner) stays in our domain and is testable;
  only the credential/passkey plumbing is delegated.
- **Reversal/revisit trigger:** IdP residency, pricing or child-appropriate-flow limitations;
  future B2B SSO (explicitly out of WP-01).

## Compliance / verification

Role-matrix, cross-family/IDOR, step-up-denial and child-cannot-reach-billing tests are the
core of WP-01 (AT-01/02/03/24/52); privileged-action audit integrity is tested against the
separate security audit log (ADR-0011).
