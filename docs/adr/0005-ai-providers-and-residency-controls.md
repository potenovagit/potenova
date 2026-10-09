# ADR-0005: AI providers, model routing and residency controls

- **Status:** Accepted (direction) — 2026-10-09 (G0, Cristian Miron); specific model/region remains **EVIDENCE REQUIRED** (ER-16)
- **Date:** 2026-10-09
- **Deciders:** AI Governance / Privacy (with Operations)
- **Requirement IDs:** AI-002/003/004 (registry, no prod data to candidates, quality-gated
  routing), PRIV-003 (no training on child data), Master §4 (Canadian processing residency),
  trust boundary B9, TM-20/21/25/47, AT-37/38/55, C-13/C-29
- **Decision class:** IMPLEMENTATION DECISION for the _abstraction_; EVIDENCE REQUIRED for the
  _specific provider/model/region_ (ER-16, owner AI Governance/Privacy, gate G2)

## Context

The hardest external constraint is **Canadian processing residency for AI inference, speech
(STT/TTS) and vision/OCR**, combined with LOCKED rules that (a) child data never trains
general models, (b) candidate/unapproved models never see production child data, and (c) the
orchestrator may route only within an approved region/age/subject/capability envelope,
fail-closed, cost never overriding.

Current-state residency findings (as of Oct 2026 — **must be re-verified at ER-16**, since
model/region availability changes):

- **AWS Bedrock in Canada** keeps _data at rest_ in Canada (Central) but, for the strong
  models, uses **cross-region inference** where the _transient inference computation may occur
  in US or global Regions_. Under a strict "inference-in-Canada" reading this **does not
  satisfy** processing residency for child prompts. (AWS ML blog, "Accelerate generative AI
  innovation in Canada with Amazon Bedrock cross-Region inference", 2025-11.)
- **Azure OpenAI** keeps inference in-region **only** with a **Regional** (non-Global, non-Data
  Zone) deployment in **Canada East / Canada Central**; Global deployments do **not** guarantee
  residency, and Data Zone does not cover Canada. An abuse-logging/no-retention exemption is
  needed to satisfy PRIV-003 / OPC expectations. (Microsoft Learn, deployment-type guidance.)
- **Azure AI Speech** and **Azure AI Document Intelligence (OCR)** are available in **Canada
  Central**, giving an in-region path for the voice + vision triad under one umbrella.
- **GCP Vertex AI** offers Montreal/Toronto regions with residency controls; in-region model
  availability varies and must be verified at ER-16.

## Options considered

1. **Single-provider convenience (default global endpoints).** Rejected — breaks processing
   residency (inference leaves Canada) and the registry/envelope model.
2. **Pick a residency-friendly default provider + a hard provider-abstraction gateway.**
   Chosen. Azure (Canada Central primary, Canada East DR) is the recommended **default** because
   it offers the most complete _in-region_ managed LLM + speech + OCR stack under one
   residency/compliance umbrella — the lowest-risk answer to ER-16 for a small team — while the
   gateway keeps the model layer vendor-independent.
3. **Self-hosted open-weight models on Canadian GPU infra.** Kept as a **hedge/fallback** for
   maximum residency control (and as the "approved fallback" tier), accepting higher ops burden
   and quality tradeoffs for some tasks.

## Decision

- Build a **provider-abstraction AI gateway** (`@potenova/domain-core/ai-gateway-policy`
  today; full module in WP-04) that enforces, **before any provider call**: residency
  allowlist (Canada only, fail-closed) → registry `APPROVED` status → age/subject/capability
  envelope → provider training disabled for child data. Cost never overrides these.
- **Recommended default provider/cloud:** Azure, **Canada Central** (primary) / **Canada East**
  (DR), using **Regional** Azure OpenAI deployments + Azure AI Speech + Azure AI Document
  Intelligence, with the no-training / limited-abuse-logging exemption in place.
- The specific model(s), versions and the residency proof are an **ER-16 evidence decision**
  resolved by third-party diligence + a controlled residency PoC in WP-04, before G2.
- Treat **model/provider independence as a first-class principle, not a fallback** (AI-004):
  the gateway must support open-weight, **self-hostable models run in-region** as a routable tier
  alongside hosted APIs, so the product is never wired to one vendor's model and the strongest
  residency/sovereignty posture (nothing leaves our VPC) is always available. A second approved
  provider and/or self-hosted Canadian-resident open model is maintained so no single vendor is a
  hard dependency (S-10).
- **Venture segregation (owner decision, 2026-10-09):** Potenova runs in its **own Azure tenant
  and subscription**, isolated from the owner's other venture (HiveDays/SectorVec, which stays on
  AWS) — separate billing, IAM, repos and CI. This is a governance/account boundary, not a
  technical dependency; it supports clean onboarding of future dedicated staff and keeps the
  child-data environment access-isolated from unrelated systems (reinforces SEC-001/SEC-002).
- **Portable primitives:** build on containers + PostgreSQL + object storage + standard queues
  rather than deep proprietary PaaS, so the cloud underneath stays swappable and a future
  jurisdiction/provider move is not a re-platform.

## Consequences

- Residency (a LOCKED invariant) is enforced at routing time regardless of which provider wins
  ER-16; provider choice stays reversible behind the gateway.
- Azure default reduces the number of distinct residency/DPA negotiations (one umbrella for
  LLM + speech + vision).
- **Reversal/revisit trigger:** ER-16 diligence shows a materially better residency/quality/cost
  provider; or a provider changes its Canadian in-region guarantees.
- **Decision rationale (2026-10-09):** the owner weighted future flexibility and
  privacy/residency as the drivers and **explicitly excluded existing-team familiarity** as a
  factor. Because the HiveDays AWS footprint is deliberately segregated (above), footprint-reuse
  was not a tiebreaker. Flexibility is delivered by the gateway + model independence + portable
  primitives (cloud-neutral); the residency tiebreak then favours Azure Canada's single-umbrella
  in-region LLM+speech+OCR. The choice is low-regret: reversible behind the gateway and validated
  by the ER-16 PoC.

## Compliance / verification

Routing fail-closed behaviour is tested now (`ai-gateway-policy.test.ts`: unapproved,
out-of-region, out-of-envelope, training-enabled child context all refused). ER-16 residency
PoC + provider DPA/no-training evidence is a G2 gate artifact.
