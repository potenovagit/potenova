# ADR-0037 — Operator/admin console: metrics, account suspend/reactivate, model-routing view

- Status: Accepted (DRAFT / synthetic-only; pre-G2, no real child data)
- Date: 2026-10-20
- Owner: Operations / Security
- Related: ADR-0017 (persistence), ADR-0018 (HTTP API), ADR-0008 (actor authz),
  WP-13 (operator status); SEC-003 (immutable audit), ER-16 (AI routing posture),
  ACC-007, AT-24/52.

## Context

The operator surface so far (WP-13, `/operator/status`) was read-only policy/AI posture. An
operator running the synthetic demo also needs a small management console: roll-up numbers, a way
to stop a misbehaving account, and visibility into which model is allowed for which activity —
without ever touching mastery, content, or a child's data. Suspension in particular must be a
**real control**, not a UI flag: it has to take effect at the edge, before any processing.

## Decision

- **`GET /operator/metrics`** — read-only roll-up: account counts (families/guardians/learners)
  from the identity repo, session counts (total/active) from the session repo, and the AI posture
  (`anyModelApprovedForProduction`, which stays false pre-G2). Counts only — no child content, no
  PII, no per-learner detail.
- **`POST /operator/accounts/:familyId/suspend` | `/reactivate`** — flips the family
  `AccountStatus` between `suspended` and `active` (`IdentityRepository.setFamilyStatus`). 404 on
  an unknown family.
- **Enforced at the edge** — the child-session route (`POST /learners/:alias/sessions`) now
  checks family status **before** the consent fence and refuses a non-`active` family with
  `POLICY_BLOCKED` (422). Suspension therefore stops new processing immediately; it is fail-closed
  (a missing family is also refused).
- **Audited** — every suspend/reactivate is appended to the immutable security audit (SEC-003)
  via `SafetyRepository.recordAudit` with `object = family:<id>`, `action =
account_suspend|account_reactivate`, `reason = account_administration`, `outcome = EXECUTED`,
  and the operator as `approver`. Account administration is never a mastery or content action.
- **Read-only model-routing view** — `/operator/status` gains a `modelRouting` section built from
  `ModelRegistry.list()`: each registered model's status, allowed regions, age/subject/capability
  envelope, training-disabled flag, and a derived `approvedForProduction` (`status === 'APPROVED'`).
  This is the registry's view, **not** a routing decision — the gateway still gates every call on
  status, Canadian region, and the envelope. Pre-G2 no model is APPROVED, so nothing is routable
  for production; with no provider configured the view is empty.
- **Operator-only** — all three surfaces require `requireActorType(…, 'operator')`; a guardian is
  forbidden (403).
- **Web** — a new **Admin** tab (`AdminView`) renders the metrics stat-grid, a family-id
  suspend/reactivate control, and the read-only model-routing table.

## Consequences

- An operator can see the engine's shape and halt an account on synthetic data, with each state
  change on the tamper-resistant audit log. Suspension is a true edge control, not cosmetic.
- Mastery stays derived, the content gate and consent fence are untouched, and routing stays a
  read-only projection — no new stored PII, no model routed, no governance line moved.
- Real admin identity/RBAC (operators are a dev-header actor type today), richer metrics, and
  tying suspension to billing/notification flows remain pre-G2 / follow-on work.
