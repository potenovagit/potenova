# ADR-0020 — Environments and the dev → qa → prod promotion pipeline

- **Status:** Accepted (implementation decision, reversible) — 2026-10-16.
  Repo side implemented: `qa` added to the config environment enum (fail-closed,
  synthetic-only, Canadian), a build-once promote-many pipeline
  (`.github/workflows/promote.yml`), a post-deploy smoke gate
  (`infra/smoke.mjs`), and a parameterised Bicep template with per-environment
  param files. Azure provisioning + GitHub secrets/vars/environments are the
  owner's step (this session cannot reach the subscription).
- **Date:** 2026-10-16
- **Deciders:** Operations / Security (owner: Cristian Miron)
- **Requirement IDs:** OPS-003 (staged deploy, kill switches, rollback), SEC-002
  (strong environment separation; no prod child data in non-prod), OPS-001
  (observability), Canadian-residency non-negotiable
- **Decision class:** IMPLEMENTATION DECISION
- **Relates to:** ADR-0013 (infra/CI/deploy/rollback), ADR-0019 (Azure runtime),
  ADR-0017 (Postgres), ADR-0018 (HTTP API); G2 gate (readiness plan)

## Context

Stage 2 runs as a single Container App fed by a manual, rebuild-on-dispatch
`deploy-api` workflow into one resource group — effectively one environment. The
product needs a change-management process: changes land in **dev**, promote to
**qa**, and on successful testing promote to **prod**. The config layer already
models `dev/test/staging/prod`, enforces Canadian regions, and surfaces
`allowRealChildData = (environment === 'prod')`, so the environment contract
exists; what is missing is the topology and the promotion mechanics.

## Decision (reversible)

**Three runtime environments — dev, qa, prod — with `qa` added to the config
enum.** `allowRealChildData` stays true only for `prod`; dev and qa are
synthetic-only by construction and fail closed on any non-Canadian region.

**Topology (owner's call): prod isolated, dev + qa shared.**

- `rg-potenova-nonprod` holds dev and qa (their own Container Apps, scale-to-zero)
  **and the single shared Azure Container Registry**.
- `rg-potenova-prod` holds prod alone (its own Container App, warm at 1 replica),
  isolated from non-prod for blast-radius and SEC-002 separation.
- Prod pulls images from the shared registry in the non-prod group via a cross-
  group `AcrPull` grant on its managed identity.

**Promotion model: build-once, promote-many, auto on green (owner's call).**

- When **CI is green on `main`**, `promote.yml` builds the API image **once**
  (tagged by commit sha) and promotes **that exact image** dev → qa → prod.
- The image is never rebuilt per stage. Environment differences (`APP_ENV`,
  regions) are injected at deploy via `--set-env-vars`; per-env secrets
  (`DATABASE_URL`, provider keys) live on each Container App. dev, qa and prod
  therefore run byte-identical code.
- Each stage runs a **post-deploy smoke check** (`infra/smoke.mjs`) and only
  advances on exit 0: qa runs only if dev's smoke passed, prod only if qa's did.
  This is the "upon successful testing, promote" gate, automated.
- Promotion is automatic with **no human approval gate** (owner's explicit
  choice). GitHub Environments (dev/qa/prod) are still used to scope secrets and
  record deployment history; required reviewers can be switched on later without
  code change if a human gate is ever wanted.

## The hard governance boundary

Promotion moves **code only**. It never turns prod into a real-child-data
service. Prod stays fail-closed (no approved model, empty usage caps) exactly as
non-prod, and the prod smoke check **asserts** that posture (`prodReady=false`,
no production-approved model) via `SMOKE_EXPECT_FAILCLOSED=true`, failing the
promotion if anyone has crossed it. Enabling real child data in prod is a
separate, manual, **post-G2** action (sign the governance gates, approve a model,
load approved caps) that this pipeline deliberately does not perform. When G2 is
signed and prod is intentionally live, flip `SMOKE_EXPECT_FAILCLOSED=false`.

## Alternatives considered

- **Manual dispatch at each stage / human approval gates** — rejected by the
  owner in favour of auto-promote-on-green. The GitHub Environments are in place
  so a required-reviewer gate can be enabled later with no code change.
- **Rebuild per environment** — rejected; defeats reproducibility. Build-once and
  promote the same digest so what passed qa is bit-identical to what reaches prod.
- **Fully shared single resource group / single app with per-env revisions** —
  rejected; prod needs isolation from non-prod (SEC-002, blast radius).
- **Separate RG + app for every environment** — more isolation than needed for
  dev/qa and higher idle cost; the owner chose prod-isolated / dev+qa-shared.

## Consequences

- One pipeline, one image, three environments; prod can be reached automatically
  but cannot process real child data without the separate G2 action.
- Rollback = re-dispatch `promote.yml` at a known-good sha (immutable tags make
  this deterministic), consistent with ADR-0013.
- Owner's provisioning tasks (outside this repo): create the two resource groups;
  deploy the Bicep with `dev.bicepparam` (creates the shared registry), then
  `qa.bicepparam` and `prod.bicepparam`; set the three Azure OIDC repo secrets;
  set repo **variables** `DEV_API_URL` / `QA_API_URL` / `PROD_API_URL`; create the
  `dev` / `qa` / `prod` GitHub Environments; grant each app's identity `AcrPull`
  on the shared registry. See `infra/azure/README`.

## Reversal triggers

- A human approval gate before prod becomes required (compliance or incident
  history) → enable required reviewers on the `prod` GitHub Environment.
- Cost or isolation needs change → re-split the resource groups.
- The G2 gate is signed → flip the prod smoke check off fail-closed and wire the
  approved model/caps as a separate, audited change.
