# ADR-0033 — Guardian identity scaffolding: IdP-subject directory + session-token exchange

- Status: Accepted (DRAFT / synthetic-only; no real IdP tenant wired)
- Date: 2026-10-19
- Owner: Identity / Security
- Related: ADR-0008 (identity, authentication, guardian delegation); ACC-001/002/003/009,
  SEC-001, NFR-02; AT-01/02/03/24/52.

## Context

ADR-0008 chose a managed IdP (Entra External ID) for guardian credential/passkey/MFA plumbing,
with Potenova keeping the family/role/consent model and all authorization in its own modules.
The auth layer already had a real `jwt` verification mode (RS256/JWKS for a real IdP, HS256 for
dev). Three pieces of the designed flow were missing, so auth was still the `x-actor-type`
header stub: the **guardian↔IdP-subject mapping**, the **session-token issuance**, and the
**sign-in exchange** that ties a verified IdP identity to a Potenova session. This ADR adds all
three as a **synthetic scaffold** — no real Entra tenant, no credentials stored — so the auth
story is demonstrable end to end pre-G2.

## Decision

- **Guardian↔subject directory** (`@potenova/identity` `guardianRefForSubject`): maps a verified,
  opaque IdP `subject` to Potenova's own `familyId`/`guardianId`. Scaffold form is a deterministic,
  stable derivation (one guardian owns one family); the production directory replaces it with a
  persisted subject→guardian row set behind the same signature. The subject is hashed into the
  ids, so the opaque IdP identifier does not leak into Potenova's id space. Guardians only —
  children never get a subject (they keep the device-bound `ChildSessionCredential`).
- **Session-token issuance** (`services/api/session-token.ts`): Potenova mints its own
  short-lived, capability-scoped HS256 JWT (ADR-0008's "server-authoritative sessions"), carrying
  only the claims the auth middleware reads — guardian actor type, owner role, family scope,
  region, `step_up=false`. Signed with the same issuer/audience/secret the `jwt`-mode middleware
  verifies, so an issued session authenticates downstream with no extra wiring. No IdP PII (e.g.
  email) is embedded or stored. Fail-closed: prod requires a real `AUTH_JWT_SECRET`.
- **Sign-in exchange** (`POST /auth/session`, pre-auth): resolves a verified guardian subject
  from either an **Entra OIDC token** (`Authorization: Bearer`, verified against configured
  Entra issuer/audience via JWKS in prod or a shared secret in tests) or, in **dev/staging only**,
  a posted synthetic `{ idpSubject }`. It provisions the family/owner-guardian on first sign-in
  (idempotent) and returns a session token. The synthetic path is **FAIL-CLOSED in production** —
  a verified token is then required.

## Scope / non-scope

In: the guardian sign-in shape, on synthetic data, with the real token-verification path wired
(exercised in tests with a locally-signed stand-in token). Not in: a real Entra tenant,
credential storage (there is none — the IdP owns it), passkey/MFA enrolment flows, step-up
re-verification, or child credentials (unchanged, device-bound). No persisted directory table yet
— the deterministic mapping stands in until the identity store gains one.

## Consequences

- The auth story is now real-ish for demo: a guardian "signs in" (synthetically), Potenova
  provisions their family and hands back a scoped session token that authenticates the rest of
  the API as a guardian/owner.
- Authorization is unchanged and still lives in Potenova's modules; only identity verification is
  (designed to be) delegated — the IdP stays reversible.
- Governance held: guardians only, no credentials or IdP PII stored, Canadian region carried in
  the session claims, synthetic-only and fail-closed in prod. Real tenant integration, Canadian
  directory residency (ER-16), and the consent-verification coupling (ER-10) remain pre-G2 items.
