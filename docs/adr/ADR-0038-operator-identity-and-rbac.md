# ADR-0038 — Real operator identity and least-privilege RBAC

- Status: Accepted (DRAFT / synthetic-only; pre-G2, no real child data)
- Date: 2026-10-20
- Owner: Security / Identity
- Related: ADR-0008 (identity, sessions, step-up), ADR-0033 (session-token exchange),
  ADR-0035 (guardian↔IdP directory), ADR-0037 (operator console);
  SEC-013 (least-privilege authz at domain boundaries), SEC-002 (time-bound JIT
  elevation; standing broad access denied), SEC-003 (dual authorization — future),
  SAFE-007, OPS-007.

## Context

Operators were authorized by actor type alone: anyone presenting `x-actor-type: operator`
(dev headers) — or, in jwt mode, a token with that claim that nothing issued — could reach every
operator surface, including the account-suspend control added in ADR-0037. That violates the
operator actor's own definition ("privileged admin, JIT, audited") and two LOCKED requirements:
**SEC-013** (least-privilege checks at domain boundaries) and **SEC-002** (sensitive operational
access requires time-bound elevation; standing broad access denied). There was no operator
identity store and no role concept.

## Decision

- **Operator role model** (`@potenova/identity/operator-roles.ts`) — a small, reversible RBAC
  taxonomy: roles `admin | support | read_only`, permissions `operator:read`,
  `operator:account_admin`, `operator:operator_admin`. `admin` holds all three; `support` and
  `read_only` are read-only today (they diverge as safety-review/kill-switch/dual-auth
  permissions land). Fail-closed by omission; `operatorCan` / `assertOperatorPermission` are pure
  and unit-tested.
- **Role on the AuthCtx** — from the verified `operator_role` JWT claim (jwt mode) or the
  `x-operator-role` header (dev mode). `requireOperatorPermission(a, perm)` fences each route and
  requires BOTH the operator actor type AND a role that grants the permission.
- **Persisted operator directory** (`operator_directory`: subject-hash → operatorId, role,
  status) — the operator analogue of the guardian directory (ADR-0035). The raw IdP subject is
  never stored, only its SHA-256 hash.
- **Operator sign-in exchange** — `POST /auth/operator/session` mirrors the guardian flow
  (verified Entra token in production shape; synthetic `{ idpSubject }` in dev/staging,
  **fail-closed in prod**). Crucially, operators are **not self-provisioned**: an unknown or
  deactivated subject is refused (SEC-002, no standing access by default), and the RBAC role is
  read **from the directory, never from the caller**. A verified, short-lived operator session
  token (`issueOperatorSession`, `OPERATOR_SESSION_TTL_SECONDS = 900`) is then minted — operator
  privilege auto-expires sooner than a guardian session. A single configured
  `OPERATOR_BOOTSTRAP_SUBJECT` is provisioned as `admin` on first sign-in (dev/staging only) to
  seed a fresh deployment's first admin.
- **RBAC applied** — `/operator/metrics` and `/operator/status` require `operator:read` (the
  independent `child_safety` actor may still read the posture directly); suspend/reactivate
  require `operator:account_admin`; a new admin-only `POST /operator/operators` (register /
  deactivate an operator, audited) requires `operator:operator_admin`.
- **Web** — the demo console's operator calls carry `x-operator-role: admin` (dev mode); in jwt
  mode the role comes from the verified token.

## Consequences

- An operator's reach is now bounded by a role resolved from a persisted directory, not by a
  spoofable actor type: a read-only operator cannot suspend an account or register operators, and
  in jwt mode only a pre-registered operator can obtain a session at all. Account/operator
  administration stays audited; mastery, content, consent and residency guards are untouched.
- Partial SEC-002: operator sessions are time-boxed (15 min) so privilege auto-expires. **Full
  just-in-time elevation** (hold `read` normally, elevate to `account_admin` for a window — the
  step-up machinery from ADR-0034 is ready to extend to operators) and **dual authorization for
  highest-risk actions** (SEC-003) remain follow-on controls. Real operator IdP/RBAC provisioning
  (operators are a configured/seeded directory today) is pre-G2 work.
