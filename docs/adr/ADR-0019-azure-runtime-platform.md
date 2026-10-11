# ADR-0019 — Azure runtime platform for the API (compute, data, secrets)

- **Status:** Accepted (implementation decision, reversible) — 2026-10-11.
  Validated by a working `staging` deploy on the owner's subscription: API on
  Azure Container Apps (Canada Central) serving over managed TLS, backed by
  Azure Database for PostgreSQL Flexible Server (Canada Central), image built in
  GitHub Actions and pulled from ACR. Verified end to end — consent fence →
  evidence ingest → derived dashboard — reading and writing the managed Postgres.
  Remaining: codify the imperative provisioning as Bicep IaC (ADR-0013).
- **Date:** 2026-10-10
- **Deciders:** Operations / Security (owner: Cristian Miron)
- **Requirement IDs:** OPS-003 (staged deploy, kill switches, rollback), SEC-002
  (environment separation), OPS-001 (observability), Canadian-residency
  non-negotiable (AI/voice/vision/analytics/logs/backup/support)
- **Decision class:** IMPLEMENTATION DECISION
- **Relates to:** ADR-0013 (infra/CI/deploy — Azure, Canada, portable primitives),
  ADR-0017 (Postgres data access), ADR-0018 (HTTP API)

## Context

ADR-0013 pins Potenova to its own Azure subscription, a Canadian region, and
**portable primitives** (containers + PostgreSQL + object storage), but deliberately
does not name the specific compute service — its stated reversal trigger is "scale
or compliance needs that favour a specific managed deployment platform." Stage 2
now has a deployable API container (ADR-0018) and a managed-Postgres data path
(ADR-0017), so the concrete runtime can be chosen. Every service must sit in the
Canadian region to satisfy the residency non-negotiable.

## Decision (recommended — reversible)

Run the single API container on **Azure Container Apps**, with these companions,
all in **Canada Central** (primary) / **Canada East** (DR):

- **Compute:** Azure Container Apps — serverless containers with revision-based
  staged rollout and traffic splitting (aligns with ADR-0013 staged releases and
  kill switches), scale-to-zero for non-prod, managed TLS ingress. Right-sized for
  a modular monolith; far less operational surface than Kubernetes.
- **Data:** Azure Database for PostgreSQL — Flexible Server, TLS required, reached
  through the node-postgres backend (ADR-0017) via `DATABASE_URL`. Backups
  geo-redundant to the DR region.
- **Registry:** Azure Container Registry (image built from `services/api/Dockerfile`).
- **Secrets / config:** Azure Key Vault; `APP_ENV`, `PRIMARY_REGION`, `DR_REGION`,
  `DATABASE_URL` injected as Container App secrets/env at runtime — never baked
  into the image (the Dockerfile keeps no defaults; `server.ts` fails closed).
- **Observability:** Azure Log Analytics / Application Insights **pinned to the
  Canadian region** — logs are in-scope for residency.
- **IaC:** Bicep under `infra/`, deployed by GitHub Actions with a manual approval
  gate per environment (ADR-0013). Authored and validated once the subscription
  exists — not committed unvalidated.

No child-facing traffic and no real model run on this platform before Gate G2; the
API processes synthetic data and still enforces every edge non-negotiable.

## Options considered

1. **Azure App Service (containers).** Simplest, but weaker container-native
   revision/traffic-split control for staged child-facing rollout. Rejected as the
   primary, viable fallback.
2. **Azure Kubernetes Service (AKS).** Maximum control; disproportionate operational
   cost for a single-container monolith at this stage. Reserved as the reversal path.
3. **Azure Container Apps.** Chosen — the balance of managed simplicity and
   staged-rollout control the requirements need.

## Consequences

- Residency holds end-to-end (compute, data, logs, backup all Canadian).
- Portability preserved: a plain OCI container + standard PostgreSQL move to AKS or
  another cloud if scale/compliance later demands (ADR-0013 reversal trigger).
- **Owner actions (done):** Azure subscription created (Free Trial), Canada
  Central/East region pair confirmed, resources provisioned imperatively via the
  Azure CLI. **Remaining:** codify as Bicep behind approval gates; move the DB
  onto a private network and swap ACR admin creds for a federated service
  principal at hardening. Cost envelope is an owner decision, not fixed here.

## Compliance / verification

The data path is already proven: the same repositories run unchanged against a real
PostgreSQL 16 server (ADR-0017 implementation note). Container build, IaC validation,
staged-rollout and rollback drills are exercised when the subscription is available
(WP-13/WP-14 gates).
