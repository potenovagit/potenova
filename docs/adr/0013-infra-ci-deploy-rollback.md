# ADR-0013: Infrastructure, CI/CD, deployment and rollback

- **Status:** Accepted — 2026-10-09 (G0 gate, approved by Cristian Miron)
- **Date:** 2026-10-09
- **Deciders:** Operations / Security
- **Requirement IDs:** OPS-003 (staged deploy, feature flags, kill switches, automated
  rollback), SEC-002 (environment separation), OPS-001 (observability), GOV-002 (traceability),
  Feature-deployment state machine 3.11, NFR-15 (model-change safety)
- **Decision class:** IMPLEMENTATION DECISION

## Context

Significant changes need staged rollout (`DRAFT → VALIDATED → LIMITED_COHORT → EXPANDED →
GENERAL`, with `ROLLED_BACK`/`DISABLED`), auditable **feature flags**, **kill switches** at the
route/content/capability level, and automated rollback. Environments (dev/test/staging/prod)
are strongly separated with distinct credentials/keys/databases; **no prod child data in
non-prod**.

## Decision

- **Monorepo + CI** (`.github/workflows/ci.yml`) running: format → typecheck → test
  (incl. architecture-fitness + adversarial suites as they land) → requirement-trace gate →
  evidence upload. CI is the enforcement point for the "v2 constraints imported / pipeline
  green" WP-00 exit condition.
- **Infrastructure as code** (declarative, region-pinned to Canada) with four isolated
  environments and per-environment secrets (never committed; `.env.example` is the template).
- **Venture segregation (ADR-0005):** Potenova lives in its **own Azure tenant/subscription**,
  separate from the owner's AWS-hosted HiveDays/SectorVec — distinct billing, IAM, repos and CI.
  Built on **portable primitives** (containers, PostgreSQL, object storage, standard queues) so
  the cloud stays swappable.
- **Feature flags + capability kill switches** as a first-class operational control, with
  model/route and content-selection kill switches independent of app deploys (S-06, S-10).
- **Staged releases + automated rollback**; releases recorded as `ReleaseRecord` with
  requirement trace, gate evidence and a rollback reference (C-31).

## Options considered

1. Trunk deploy straight to prod. **Rejected** — violates staged-rollout/kill-switch
   requirements for child-facing changes.
2. IaC + staged flags/kill-switches + requirement-trace-gated CI. **Chosen.**

## Consequences

- Every release is reproducible and traceable; child-facing risk is contained behind flags and
  kill switches decoupled from code deploys.
- **Reversal/revisit trigger:** scale or compliance needs that favour a specific managed
  deployment/flag platform.

## Compliance / verification

CI green is demonstrated in WP-00 (format/typecheck/42 tests/trace). Release rehearsal,
rollback drills and kill-switch tests are exercised in WP-13/WP-14.
