# ADR-0043 — AI provider usage/cost accounting and operator observability

- Status: Accepted (DRAFT / synthetic-only; pre-G2, no real child data)
- Date: 2026-10-20
- Owner: AI Governance / Operations
- Related: ADR-0005/0006 (AI gateway + provider seam), ADR-0018 (HTTP API);
  AI-013 (measure usage/cost by family/learner/session/capability/provider/model),
  AI-014 (cost anomalies alert operators, child never informed),
  AI-020 (outcomes observed alongside cost), C-32 (no child content in cost events),
  NFR-02 (residency), ER-01/NFR-14 (unit economics — EVIDENCE REQUIRED).

## Context

Stage 2 Step 3 is "the AI provider arrives". The gateway, the `GenerativeProvider` seam, the Azure
adapter and the candidate-evaluation route already call a real (non-approved) model on **synthetic**
data, fail-closed (residency → approved → envelope; a candidate is reachable only via the eval
path, never a child route). What was missing is the other half of wiring a provider in: its
**usage and cost were discarded** — `CostLedger` was in-memory only, the provider's token `units`
were returned in the HTTP response but never persisted, and operators had no usage/cost view. That
left AI-013, AI-014 and AI-020 unimplemented.

A real $ rate and the cost budget are unit economics — **EVIDENCE REQUIRED** (ER-01/NFR-14), so
cost must be a clearly-DRAFT estimate, never a stored or approved figure.

## Decision

- **Persisted usage ledger** — an append-only `ai_usage_event` table + `AiUsageRepository`. Each
  event is privacy-safe: aliases + the authoritative token `units` only, screened by the gateway's
  `assertCostPayloadClean` (C-32 — no raw child content). **Cost is not stored**: it is derived
  from `DRAFT_UNIT_COST` on read, so recalibrating the (unapproved) rate never strands a figure.
  The `familyAlias/learnerAlias/sessionId` columns are null pre-G2 (synthetic eval has no child)
  and are ready for approved child routing at G2 (the AI-013 drill-down dimensions).
- **Eval path records usage** — both `/operator/model-eval` and `/operator/model-eval/suite` now
  record a usage event with the provider's real `units`, and raise an **operator-only cost anomaly**
  on the audit log (`ai_cost_anomaly`, outcome `ALERT`) when the DRAFT estimate exceeds the DRAFT
  session budget (AI-014). Nothing here reaches or informs a child (`deliveredToChild: false`).
- **Operator observability** — `/operator/metrics` reports `ai.usage` (events, total units, DRAFT
  estimated cost) alongside the existing eval outcomes (AI-020), and a new `GET /operator/ai-usage`
  gives the AI-013 drill-down by model / capability / provider. Every cost figure is labelled DRAFT.
- **Web** — the Admin tab shows the eval token-unit total.

## Consequences

- The provider is now wired end to end on synthetic data: a candidate run is routed fail-closed,
  invoked, validated by the independent oracle, and its usage is metered, persisted privacy-safe,
  surfaced to operators, and anomaly-alerted — the AI-013/014/020 backbone, built before any model
  can reach a child.
- **DRAFT cost only**: the per-unit rate and the budget stay EVIDENCE REQUIRED (owner: unit
  economics from the beta); figures are estimates, never approved. A **live** Azure endpoint
  remains blocked on ER-16 (deferred) and, even configured, is registered SYNTHETIC_TESTING and
  cannot reach a child until a model is APPROVED at G2 — at which point the child-dimension usage
  columns begin to populate. Bounded-retry cost controls (AI-015) and route-decision logging
  (AI-006) remain follow-on.
