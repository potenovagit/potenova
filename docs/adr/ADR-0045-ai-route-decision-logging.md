# ADR-0045 — AI route-decision logging + task-specific route probe

- Status: Accepted (DRAFT / synthetic-only; pre-G2, no real child data)
- Date: 2026-10-20
- Owner: AI Governance
- Related: ADR-0005/0006 (AI gateway + router), ADR-0043 (usage/cost), ADR-0044 (bounded invocation);
  AI-006 (task-specific routing across text/speech/vision; route decision logs model, policy,
  capability, cost, fallback reason), AI-004 (cost never overrides residency/quality), NFR-02.

## Context

The gateway already routes fail-closed by capability (residency → approved → envelope, with an
in-region fallback). AI-006 additionally requires that each routing decision be **logged** — the
chosen model, the policy, the capability, the cost and the fallback/block reason — and that
routing support text, speech and vision capabilities. Nothing persisted a decision, and `route()`
(the production child-routing entry) is not yet called anywhere, so there was no decision trail.

## Decision

- **Route-decision log** — an append-only `route_decision` table + `RouteDecisionRepository`.
  Each row carries capability, requested/chosen model, outcome, the policy that decided it, the
  fallback/block reason code, processing region, child-context and synthetic flags, and (when the
  route was invoked) token units. Identifiers and reason codes only — never child content.
- **Two producers, both synthetic pre-G2:**
  - the **eval path** logs its routing decision — `EVAL_ROUTE` with the candidate model and the
    real token units, or `FALLBACK` with the bounded-invocation reason (ADR-0044);
  - a **route probe** (`POST /operator/route-probe`, `operator:read`) exercises the gateway's
    `route()` across a given capability (text / speech / vision) on synthetic inputs and logs the
    decision. With no model APPROVED pre-G2 a child-context route fails closed to `BLOCK` with its
    reason (e.g. `REGION_DISALLOWED` for a non-Canadian region) — exactly the decision the log must
    capture, and the same recorder the child path will use at G2.
- **Surfaced** — `GET /operator/route-decisions` lists the log; operator metrics gain
  `ai.routeDecisions`.

## Consequences

- Every routing decision now leaves an auditable trail with model, policy, capability, cost
  (units, where invoked) and fallback/block reason — AI-006's logging requirement — and the probe
  demonstrates task-specific routing across the three capability classes, fail-closed.
- "Cost" on a decision is the invoked token units; for a pre-invocation BLOCK/probe it is null, and
  actual spend lives in the usage ledger (ADR-0043) keyed by the same model + capability. The
  production `route()` path is exercised only via the probe until a model is APPROVED at G2, when
  the child-routing call will log through the same recorder with real child-context decisions.
  Synthetic/pre-G2.
