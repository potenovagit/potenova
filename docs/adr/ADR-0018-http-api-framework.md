# ADR-0018 — HTTP API framework and Stage-2 scope progression

- **Status:** Accepted (implementation decision, reversible) — 2026-10-10
- **Context:** Stage 2 Step 2 (make it a running app); supersedes the WP-00 scope note
- **Relates to:** ADR-0001 (modular monolith), ADR-0017 (persistence), GOV-001

## Decision

The service exposes its first real HTTP surface using **Hono** — a small,
TypeScript-first framework that runs on Node via `@hono/node-server` and offers
an in-process request client (`app.request`) so the whole API is testable in CI
without binding a port. The app is wired to the shared `PotenovaDb` repositories
(ADR-0017) and to the existing domain guards.

### Scope progression (documented deviation — GOV-001)

The WP-00 scope note barred any child-facing endpoint. WP-00→WP-13 are complete
and the product owner approved Stage 2. This ADR records that approval. The API:

- runs on **synthetic data only**; no real child data before Gate G2;
- wires **no real model** (that is Stage 2 Step 3 / ER-16);
- enforces the LOCKED non-negotiables **at the edge**, delegating to the domain:
  consent fence (no processing before a stored `child_learning` grant), content
  gate (`decideDelivery` — nothing unvalidated reaches a child), Canadian
  residency allowlist, role/actor authorization, and evidence-producer-only
  ingest so mastery stays derived (never hand-set).

Authentication is a **header-driven dev shim** standing in for the managed IdP
(passkeys/MFA, ADR-0008); the authorization rules it feeds are the real guards.

## Alternatives considered

- **Fastify / Express** — heavier; Fastify's `inject` also tests without a port,
  but Hono is lighter and fetch-native, which suits the shared-logic monolith.
- **Node stdlib http only** — zero deps but hand-rolled routing/body parsing and
  weaker typing; rejected as more error-prone.

## Consequences

- Reversible: routes are thin adapters over domain functions + repositories, so
  the framework is swappable with contained effort.
- Real auth (IdP), rate limiting, and the OpenAPI contract are follow-ups; the
  header shim is explicitly not the production identity path.
