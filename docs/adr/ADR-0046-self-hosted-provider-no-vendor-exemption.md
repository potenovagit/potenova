# ADR-0046 — Self-hosted in-region model; no reliance on a vendor abuse-monitoring exemption

- Status: Accepted (direction) — 2026-10-20 (Cristian Miron, AI Governance). Specific model,
  host and region remain EVIDENCE REQUIRED (feeds the G2 provider-approval gate, ADR-0005).
- Date: 2026-10-20
- Deciders: AI Governance / Privacy (with Operations)
- Related / supersedes: ADR-0005 (AI providers + residency — this resolves part of its
  EVIDENCE-REQUIRED provider question); ER-16, PRIV-003/004/005, SEC-009/012, Master §4
  Canadian residency, AI-002/003/004.
- Decision class: IMPLEMENTATION DECISION (reversible — the provider seam abstracts it).

## Context

ER-16 assumed the candidate provider would be **Azure OpenAI**, which for a children's service
requires a **modified abuse-monitoring exemption** (no retention, no human review) — default
monitoring retains prompts/completions ~30 days with possible human review, incompatible with our
no-retention consent basis (PRIV-004) and PIPEDA minimization. Microsoft **denied** that
application (Application ID 3944238) on the basis that the organization is **unmanaged**, and
offered only managed-customer / Microsoft-for-Startups verification paths. The owner's decision is
to **not build Potenova's compliance posture on a discretionary vendor exemption** we do not
control and that a company of our size cannot rely on Microsoft to grant or keep.

## Decision

- **Self-host an in-region, open-weights model** behind the existing provider seam (ADR-0005).
  Inference runs on **Canadian compute we control** (e.g. Canadian GPU on Azure-as-IaaS, AKS, or
  another Canadian host) — using a cloud as infrastructure under its standard DPA is distinct from
  the gated Azure OpenAI service and needs **no exemption**. Retention and residency are held
  directly: there is no third-party abuse-monitoring/retention surface over children's data, and
  no OpenAI/Microsoft inference subprocessor.
- **Adapter:** `SelfHostedChatProvider` (`@potenova/ai-gateway`) calls an OpenAI-compatible server
  (vLLM / TGI / Ollama). It carries its Canadian `region`, fails closed on error, and registers as
  `SYNTHETIC_TESTING` — never APPROVED until G2. Wired from env (`SELFHOST_ENDPOINT`,
  `SELFHOST_MODEL`, `SELFHOST_REGION`, optional key/path). The gateway, eval harness, usage/cost,
  bounded invocation and route logging treat it identically to any other provider.

## Consequences

- **Removed from the governance load:** the discretionary Microsoft approval gate on the critical
  path; the abuse-monitoring retention/review surface over children's data; and the OpenAI/MS
  inference subprocessor. ER-16's external half collapses from "win a vendor exemption" to
  "document our Canadian hosting arrangement's residency + DPA" — in our control.
- **Taken on:** model selection + licensing; inference-layer security, availability and patching
  (SEC-005/007/008 for that layer now ours); our own safety guardrails (the content gate, child-
  safety layer and fail-closed fallback already provide these); and the cost profile — self-host is
  mostly-fixed GPU cost, which for a spiky kids'-tutoring load is a premium over per-token API, not
  a saving (`infra/ai-cost-model.mjs`). This is accepted as the price of control, not a cost play.
- **Unchanged:** every fail-closed non-negotiable still binds — Canadian residency across the
  stack, content gate, no unapproved/out-of-envelope/out-of-region routing, no real child data
  before consent + G2. The G2 provider-approval artifact (ADR-0005) becomes our residency-
  controlled hosting + the quality/safety eval against our model + privacy-counsel/PIA sign-off
  (SEC-009/012) — with no outside party able to block or revoke it.
- **Reversible:** the seam abstracts the provider, so a later switch (to a managed API, if the
  gating story ever changes) is a config + adapter change, not a rewrite.

## Follow-on (EVIDENCE REQUIRED / owner action)

Pick the specific open model (licence must permit commercial + children's-education use); pick the
Canadian host and GPU; run the quality/safety eval against the candidate on synthetic data; and
take the self-hosted flow through the PIA (SEC-009) and the legal/privacy readiness gate (SEC-012)
before any real child data. A gateway payload-minimization / de-identification guard is recommended
regardless.
