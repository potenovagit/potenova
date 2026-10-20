# ADR-0041 — Richer operator metrics and suspension → billing/notification flows

- Status: Accepted (DRAFT / synthetic-only; pre-G2, no real child data)
- Date: 2026-10-20
- Owner: Operations / Billing
- Related: ADR-0037 (operator console — this is its named follow-on), ADR-0038/0039/0040
  (operator RBAC / JIT / dual-auth); SEC-013, AI-014/AI-020 (operator observability),
  BILL entitlement lifecycle.

## Context

ADR-0037 shipped `/operator/metrics` as bare counts and suspend/reactivate as a status flip, and
named two follow-ons: richer metrics, and tying suspension into billing/notification flows. The
design question for the latter is how account suspension relates to billing. Entitlement is a
state machine (`TRIAL_ACTIVE → … → PAID_EXPIRED`) with no administrative "suspended" state, and
account suspension already supersedes entitlement at the session edge (a suspended family is
refused a child session before the consent/entitlement checks). So forcing an entitlement
transition on suspend would be both semantically wrong and frequently illegal (e.g. from
`TRIAL_ACTIVE`), and it would also have the operator console reach across a domain boundary into
billing's lifecycle.

## Decision

- **Richer metrics** — `/operator/metrics` now reports: account counts plus a `byStatus`
  breakdown (active/suspended/closed); session total/active; a **billing posture**
  (entitlement counts by state, and `learningActiveFamilies` via billing's own `learningActive`);
  a **safety/governance posture** (`killSwitchesDisabled`, `pendingDualAuth`); the pending
  notification count; and AI posture plus recorded `evalRuns`. Each field is a real repository
  aggregate. A read-only `GET /operator/notifications` surfaces the pending outbox.
- **Suspension → billing/notification via an outbox, not a state mutation** — a new
  enqueue-only **notification outbox** (`notification` table + `NotificationRepository`) carries
  both guardian-facing messages and signals the billing service consumes. On suspend it enqueues
  `guardian:account_suspended` + `billing:billing_hold`; on reactivate,
  `guardian:account_reactivated` + `billing:billing_resume`. The entitlement state machine is
  **not** touched — billing owns its lifecycle and reacts to the signal; suspension remains the
  administrative overlay that already gates access at the edge. The status change stays audited.

## Consequences

- Operators get a far more useful read of the system (account health, billing posture, safety
  signals, the outbox), and suspend/reactivate now propagate to billing and the family through a
  clean, decoupled event rather than a cross-domain write — which respects the actor boundaries
  (operator vs billing_service) the spec cares about.
- The outbox is **enqueue-only**: delivery is out of scope pre-G2. There is no email/SMS provider
  wired, and any real delivery must honour Canadian residency and consent — a delivery worker and
  the provider decision (EVIDENCE REQUIRED) are follow-on. The `billing_hold`/`resume` consumer in
  the billing service is likewise follow-on; today the signal is recorded, not acted on.
- Still synthetic/pre-G2 and behind the deferred external sign-offs. Account `closed` status is
  counted but not yet produced by any flow.
