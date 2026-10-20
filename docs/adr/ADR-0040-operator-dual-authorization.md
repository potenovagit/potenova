# ADR-0040 — Dual authorization for the highest-risk operator actions

- Status: Accepted (DRAFT / synthetic-only; pre-G2, no real child data)
- Date: 2026-10-20
- Owner: Security
- Related: ADR-0038 (operator identity + RBAC), ADR-0039 (operator JIT elevation),
  ADR-0037 (operator console); SEC-003 (dual authorization), SEC-013, SEC-002,
  SAFE-007, SAFE-012 (kill switch).

## Context

ADR-0038/0039 bound a single operator — RBAC bounds _what_, JIT elevation bounds _when_. But the
catastrophic actions must not be doable by one person at all. **SEC-003** (LOCKED): "Dual
authorization SHALL be required for defined highest-risk actions. One operator cannot
independently export bulk child data or disable critical safety controls." This is separation of
duty (maker-checker): two distinct operators for the worst actions.

Note a traceability caveat: in the repo's authoritative `requirements.csv`/`requirements.json`,
**SEC-003 = dual authorization**. An older `05_Security_Privacy_Child_Safety_Specification` uses a
different SEC-00x numbering (there SEC-003 is the tamper-resistant audit log), which is what some
existing code comments cited. This record and its code cite the CSV IDs; the comment drift has
since been reconciled — the tamper-resistant audit-log references now cite **SEC-004** (its CSV ID),
leaving **SEC-003** for dual authorization throughout.

## Decision

- **Maker-checker flow**: `POST /operator/dual-auth/requests` (requester) creates a PENDING
  request; a **different** operator calls `.../:id/approve`, and only then does the action
  execute; `.../:id/deny` closes it; `GET /operator/dual-auth/requests` lists pending.
- **Three stacked guards (fail-closed)**: both the requester and the approver must (1) hold the
  action's operator permission (SEC-013) and (2) be JIT-elevated (SEC-002); and (3) the approver
  must differ from the requester (`requestedBy ≠ approver`) — the requester can never self-approve.
- **One-shot, time-boxed**: a request is single-use via a compare-and-set transition (two
  approvers cannot double-execute), and expires (`DUAL_AUTH_REQUEST_TTL_SECONDS`, provisionally
  1h) so an approval cannot be banked.
- **Audited end to end**: `dual_auth_requested` (outcome PENDING, with expiry) and
  `dual_auth_approved` (outcome EXECUTED, naming the requester) / `dual_auth_denied` are written
  to the immutable security audit, so both parties are on the record.
- **Persistence**: a `dual_auth_request` table (separate from the audit log), with the request's
  parameters JSON-encoded. Methods on `SafetyRepository`.
- **Defined action set** — the registry (`@potenova/identity/dual-authorization.ts`) defaults to
  the two actions the requirement names: `child_data.bulk_export` and `safety_control.disable`.
  Execution is synthetic pre-G2: bulk export returns a manifest (learner-id count only, never
  child content); safety-control disable flips the real kill switch (SAFE-012), a readable effect.

## Consequences

- SEC-003 is met for the two named actions: neither a bulk child-data export nor disabling a
  safety control can be done by one operator — it takes a second, elevated, distinct operator, and
  both are audited. The operator-security arc (RBAC → JIT → dual-auth) is now complete on
  synthetic data.
- **EVIDENCE REQUIRED (owner: Security)**: the _full_ set of highest-risk actions is a governance
  decision, not an implementation one — the registry default is a starting point. Open follow-ons:
  a dedicated permission or a distinct second-approver role (e.g. a safety officer for
  `safety_control.disable`, per SAFE-007); whether the very worst actions need N-of-M rather than
  2; the request TTL; and a break-glass path with mandatory after-the-fact review.
- Like the rest of the operator track, this is a _real_ boundary only under the production IdP (in
  dev-header mode `requestedBy ≠ approver` is demonstrable, not enforceable) and is a G2 control —
  it guards real child data, so it sits behind the deferred external sign-offs. No web UI yet; the
  flow is API-only for now.
