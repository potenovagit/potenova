# ADR-0034 — Step-up re-verification for sensitive guardian actions

- Status: Accepted (DRAFT / synthetic-only; no real IdP re-verification wired)
- Date: 2026-10-19
- Owner: Identity / Security
- Related: ADR-0008 (identity, step-up), ADR-0033 (session-token exchange);
  ACC-007, AT-24/52, SEC-001.

## Context

ADR-0008 requires **step-up re-verification** before sensitive guardian actions (billing, data
export, deletion, guardian grants). The session model (ADR-0033) already carried a `step_up`
claim, but nothing issued a stepped-up session or enforced it, so the sensitive routes ran on a
normal session.

## Decision

- **`STEP_UP_REQUIRED` error code** (403) — a distinct, client-actionable signal (not the
  overloaded `REVIEW_REQUIRED`), so a client knows to re-verify rather than treating it as a
  generic authorization failure.
- **`requireStepUp(a)` guard** (`auth.ts`) — fail-closed: refuses unless the session is stepped
  up. In `jwt` mode `stepUp` comes only from a verified step-up token; the dev header shim honours
  `x-step-up` (dev is not a security boundary either way).
- **`POST /auth/step-up`** — elevates the caller's current guardian session (verified Bearer) to
  a **short-lived** (`STEP_UP_TTL_SECONDS` = 300s) `step_up=true` token. The re-verification
  itself (MFA / passkey re-prompt) is the IdP's — synthetic here, and **fail-closed in
  production**, where the endpoint is disabled and real IdP re-verification applies.
- **Enforcement** — applied to the DSAR intake `POST /learners/:alias/data-requests`, which
  covers both export (`access`) and deletion (`erasure`). This is the sensitive guardian route
  that exists today; the guard is exported and ready for the billing-mutation and guardian-grant
  routes when those are added (neither exists yet).
- **Web** — `api.stepUp()` elevates the session token (jwt mode) and flags `x-step-up` (dev mode),
  and the dashboard's export/erasure actions call it first, so the demo flow steps up before a
  sensitive request.

## Consequences

- A sensitive guardian action now requires a recent re-verification; the elevation is time-boxed
  to five minutes, so a stepped-up session does not stay privileged.
- Governance held: fail-closed by default, a distinct refusal code, synthetic re-verification
  disabled in production, no new stored data. Real IdP re-verification (passkey/MFA re-prompt),
  the billing-mutation and guardian-grant routes, and step-up audit logging remain pre-G2 /
  follow-on work.
