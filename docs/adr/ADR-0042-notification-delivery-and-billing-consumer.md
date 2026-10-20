# ADR-0042 — Notification delivery worker and billing hold/resume consumer

- Status: Accepted (DRAFT / synthetic-only; pre-G2, no real child data)
- Date: 2026-10-20
- Owner: Operations / Billing
- Related: ADR-0041 (the outbox this drains), ADR-0037 (operator console);
  NFR-02 (Canadian residency), SEC-013, BILL entitlement lifecycle, PRIV (consent).

## Context

ADR-0041 added an enqueue-only notification outbox (guardian messages + billing signals) and
named two follow-ons: a delivery worker and the billing hold/resume consumer. Both were deferred
because **delivery needs a provider decision that is EVIDENCE REQUIRED and residency/consent-bound**
— no email/SMS provider is approved, and any real one must process in the Canadian region and
respect consent. The design must therefore be fail-closed, not a stubbed "pretend send".

## Decision

- **Delivery worker** (`runNotificationDelivery`) drains PENDING guardian notifications through a
  `NotificationProvider` abstraction, **fail-closed** exactly like the AI gateway:
  no provider → `HELD_NO_PROVIDER` (nothing sent); provider region not in the Canadian allowlist
  → `BLOCKED_REGION` (NFR-02); the subject family erased/closed → `HELD_NO_SUBJECT` (an erased
  subject is never messaged — a consent/lifecycle gate); otherwise `DELIVERED`. `deps.notificationProvider`
  is **null by default everywhere** (prod and dev) — a provider is only injected (tests) — so until
  an approved provider is wired, dispatch delivers nothing and simply records the held state.
- **Billing consumer** (`runBillingSignalProcessing`) drains PENDING `billing` signals and applies
  a **billing hold overlay** (`billing_hold` table; `BillingRepository.setHold/getHold/heldCount`):
  `billing_hold` → held, `billing_resume` → cleared. It **never** transitions the entitlement state
  machine (honouring ADR-0041) — the hold is an invoicing-pause overlay the billing service
  honours, and entitlement is left exactly as-is. Each signal is marked PROCESSED and audited.
- **Triggers** — `POST /operator/notifications/dispatch` and `POST /operator/billing/process-signals`,
  both `operator:account_admin` (sensitive → JIT-elevated) and audited. In production these run as
  scheduled system jobs, not operator-invoked; the endpoints are the synthetic demo/test surface.
- **Metrics** — operator metrics gain `billing.holds` (families currently on hold).

## Consequences

- The outbox now has consumers on both sides, both correct under the governance line: guardian
  delivery is fail-closed and residency-gated so nothing can be sent off-region or without an
  approved provider, and the billing hold is a clean overlay that never corrupts the entitlement
  lifecycle or crosses the operator→billing actor boundary with a direct write.
- **Still no real delivery**: the provider remains EVIDENCE REQUIRED (owner: a provider choice
  that is Canadian-resident and consent-scoped). Until then every guardian notification is held.
  The hold overlay is recorded but not yet read by an invoicing flow (no invoicing exists pre-G2).
  A real comms-consent purpose (vs the lifecycle gate used here) is also EVIDENCE REQUIRED.
- Synthetic/pre-G2, behind the deferred external sign-offs.
