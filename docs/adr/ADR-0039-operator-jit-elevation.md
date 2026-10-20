# ADR-0039 — Operator just-in-time elevation for sensitive actions

- Status: Accepted (DRAFT / synthetic-only; pre-G2, no real child data)
- Date: 2026-10-20
- Owner: Security / Identity
- Related: ADR-0038 (operator identity + RBAC), ADR-0034 (guardian step-up),
  ADR-0008 (sessions, step-up); SEC-002 (time-bound JIT elevation; privileged
  entitlement auto-expires; standing broad access denied), SEC-013,
  SEC-003 (dual authorization — future).

## Context

ADR-0038 gave operators real identity and role-based least privilege, but the role was held
**standing**: an `admin` could suspend an account at any point in its (15-minute) session. SEC-002
requires more — sensitive operational access must be a **time-bound just-in-time elevation** that
auto-expires, with no standing broad authority. This is the operator analogue of the guardian
step-up (ADR-0034); the machinery was deliberately shaped to extend.

## Decision

- **Sensitive operator permissions** — `operator:account_admin` and `operator:operator_admin` are
  classified sensitive (`SENSITIVE_OPERATOR_PERMISSIONS`); `operator:read` is not.
- **Two independent guards** in `assertOperatorPermission` (fail-closed): (1) the RBAC role must
  grant the permission (SEC-013); (2) a sensitive permission additionally requires a current
  elevation, else `STEP_UP_REQUIRED`. So even an admin cannot mutate on a standing session, while
  reads need no elevation. Order matters: a role that lacks the permission fails first with
  `FORBIDDEN_ROLE`, so elevation state never leaks whether a permission exists.
- **`POST /auth/operator/step-up`** — verifies the caller's current operator session and mints a
  short-lived elevated token (`step_up=true`, `OPERATOR_STEP_UP_TTL_SECONDS = 300`), so the
  privilege auto-expires in five minutes. Synthetic re-verification in dev/staging,
  **fail-closed in production** (the real IdP MFA/passkey re-prompt applies there). The elevation
  is recorded on the immutable security audit (`operator_jit_elevation` /
  `operator_step_up_elevation`, with the window expiry).
- **AuthCtx** — `requireOperatorPermission` passes `elevated: a.stepUp`, reusing the existing
  `step_up` claim (jwt) / `x-step-up` header (dev shim) that the guardian flow already uses.
- **Web** — the demo console's suspend/reactivate flags `x-step-up` (dev shim); in jwt mode the
  operator session is elevated via the step-up endpoint before the call.

## Consequences

- SEC-002 is now met for operators: sensitive actions require a fresh, five-minute elevation, and
  no operator holds standing mutation authority — the account-admin control from ADR-0037 is
  reachable only through an audited JIT step-up. Reads are unaffected, so routine monitoring does
  not force elevation.
- **Dual authorization for the highest-risk actions (SEC-003)** — e.g. bulk child-data export or
  disabling a critical safety control requiring two operators — remains the next control; the
  per-action audit and the elevation window are the foundation it builds on. Real IdP
  re-verification (vs the synthetic dev/staging step-up) arrives with the production IdP wiring.
