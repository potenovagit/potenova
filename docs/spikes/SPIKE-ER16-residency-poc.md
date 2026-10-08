# SPIKE ER-16 — Canadian AI Residency & Latency Proof-of-Concept

**Status:** Ready to run (does not depend on the WP-01 inputs) · **Timebox:** ~1 week
(5–8 engineer-days) · **Owner:** AI Governance / Privacy (with Operations) · **Decision it
informs:** confirms or amends **ADR-0005** (Azure/Canada default) and produces provisional
numbers for **ER-05** (latency). · **Data:** synthetic only — no child data, no production
deployment, no child-facing endpoint.

## Why this spike, and why now

The cloud/residency decision (ADR-0005) was approved in _direction_, but the binding fact —
that AI **inference**, **speech** and **vision/OCR** actually process **inside Canada** — is an
`EVIDENCE REQUIRED` item (ER-16) that convenience/global endpoints quietly break. This is the
single biggest technical unknown behind the approved architecture, and it has a lead-time
dependency (Azure Limited Access / no-logging approval), so it is worth starting before WP-04
proper. The spike also yields the first real latency and per-operation cost numbers, feeding
ER-05 and the NFR-14/ER-01 cost model.

## Objective

Prove, with evidence, that a Canadian-resident path exists for the full AI triad under the
approved default, measure its interactive latency, and confirm a fallback route — or surface a
residency/latency blocker early enough to re-evaluate (GCP Vertex in-region, or a self-hosted
open model in a Canadian region) before it is load-bearing.

## In scope

1. **Provision** an isolated, non-prod Azure resource group in **Canada Central** (primary) with a
   **Canada East** check, region-pinned via IaC, synthetic-data-only.
2. **Deploy** the triad as **Regional** (not Global, not Data Zone) deployments:
   - Azure OpenAI — a chat/instruction model (+ embeddings if the validator needs them).
   - Azure AI **Speech** — STT and TTS.
   - Azure AI **Document Intelligence** — OCR.
3. **Confirm residency** per modality: deployment type is Regional; resource region is Canadian;
   inspect network egress/routing where observable; **obtain Microsoft's written confirmation**
   of the inference region for the specific model + deployment type.
4. **Confirm the privacy posture** for the child-data path: the no-training guarantee plus the
   **limited/abuse-logging exemption** (so prompts/outputs are not retained) — required by
   PRIV-003 and OPC expectations. Start the Limited Access request on **day 1** (lead time).
5. **Exercise** representative tasks with **synthetic** Grade 2–5 Math/English fixtures (extend
   `@potenova/fixtures`): generate-instruction, independent validation (deterministic + model),
   STT on a short synthetic read-aloud clip, TTS, OCR on a synthetic worksheet image.
6. **Route through a thin stub** that implements the `@potenova/domain-core/ai-gateway-policy`
   `routeModel` contract (residency allowlist = `ca-central`/`ca-east`), so an out-of-region
   route is refused fail-closed — this proves the gateway model end-to-end and makes the results
   transfer directly to WP-04.
7. **Measure** P50/P95/P99 latency per modality (text turn, spoken-turn round-trip, OCR) from
   Canada Central under light concurrency; record cold vs warm. **Capture** list-price cost per
   operation.
8. **Confirm a fallback** route exists (second Canadian region, a second approved provider, or a
   self-hosted Canadian-resident open model) that can serve the generate/validate path if the
   primary is unavailable (S-10) — design confirmation plus one smoke test if time allows.

## Out of scope

No child data (synthetic only); no production or staging deployment; no child-facing endpoint;
**not** selecting the final model (that is the ER-16 decision this _informs_); **not** a quality/
accuracy evaluation (ER-17 / WP-05); **not** building the real AI gateway (WP-04) — only the thin
contract-shaped stub.

## Method (ordered)

1. IaC stand-up of the Canada-region RG (dev, synthetic-only, region-pinned).
2. Submit the Limited Access / no-logging request (day 1 — it gates step 4's confirmation).
3. Deploy the three services as Regional deployments in Canada Central (+ a Canada East deploy to
   confirm the DR region is viable).
4. Build the harness: a runner calling the three services **through** the `routeModel` stub, with
   provider keys injected from env (never committed; `.env.example` pattern). Include a negative
   test that a `us-*` processing region is refused before any call.
5. Run the synthetic task battery; collect latency, cost and traces (no child content in traces).
6. Attempt egress/region verification; file the Microsoft written-confirmation request.
7. Write evidence to `evidence/ER-16/<run-id>/`: synthetic fixture IDs, measured latency tables,
   per-op cost, residency attestation (config export + MS confirmation), redacted traces, and the
   go/no-go recommendation.

## Success criteria (go)

- Inference, STT, TTS and OCR each **demonstrably process in a Canadian region** (Regional
  deployment confirmed; no cross-region egress observed; Microsoft written confirmation obtained).
- **No-training + no-retention** (or a scoped abuse-logging exemption) confirmed for the
  child-data path.
- Measured **P95 latencies within a plausible interactive band**; propose _provisional_ ER-05
  targets (owner signs them off separately — do not record as final).
- A **viable fallback** route confirmed (design + smoke).

## No-go / escalation triggers

- Any modality's inference leaves Canada and can't be pinned Regional → **residency gap**:
  evaluate GCP Vertex in-region or a self-hosted open model; revisit the ADR-0005 default.
- No-logging exemption unavailable for the child context → **privacy blocker** (PRIV-003);
  escalate to Privacy/Legal.
- P95 far outside an interactive band with no mitigation (lighter model / caching / streaming) →
  feeds the ER-05 risk and may reopen the model choice.

## Decision outputs

Confirms or amends **ADR-0005**; provisional **ER-05** latency numbers; seed data for
**NFR-14/ER-01** cost modelling; a **residency attestation** artifact for the PIA (ER-07/ER-16)
and the G2 security gate.

## Risks & dependencies

- **Lead time:** Azure Limited Access / no-logging approval — start day 1.
- **Availability:** a model may be narrower in a Canada Regional deployment than globally — that
  is part of what we are measuring, not a surprise.
- **Fixtures:** synthetic voice clip + handwritten-worksheet image need creating (small; extend
  `@potenova/fixtures`).
- **Needs:** an Azure subscription + billing; an owner to file Limited Access; synthetic AV/image
  fixtures.

## Requirement / gate linkage

ER-16 (primary) · ER-05 (latency) · PRIV-003, TM-20/22 (no training, voice retention) ·
TM-21 / AT-55 (residency routing) · NFR-11/14 · feeds **G2**.
