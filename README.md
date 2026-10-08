# Potenova — Engineering Foundation (WP-00)

This repository is the **WP-00 engineering foundation** for Potenova, the parent-paid
AI tutoring platform for Ontario Grades 1–8 Math and English. It is built against the
**Build-Ready Specification Baseline v2.0** and deliberately contains **no child-facing
features, no tutoring/subscription logic, and no production child-data processing**.

> Working brand "Potenova" is subject to trademark clearance (ER-18). The name can
> change without changing the architecture.

## What WP-00 delivers

- A **modular-monolith** scaffold with the 14 bounded domains declared as module boundaries
  (`services/api/src/modules.ts`), no premature microservices.
- The platform's **LOCKED invariants encoded as executable guards** in `@potenova/domain-core`
  and enforced by architecture-fitness tests:
  - tutoring / parent / billing **cannot write learner mastery** (only the evidence-replay projector can);
  - unapproved or out-of-Canada models **cannot be routed**;
  - unvalidated content **cannot reach a child**;
  - **no processing without consent**, and a revocation fence;
  - learner evidence is **append-only** (corrections append, never mutate).
- A **requirement-trace** tool that imports the v2 register (`spec/requirements.csv`) and
  gates CI on its shape (276 requirements, 16 domains, all LOCKED).
- **Synthetic-only** fixtures (`@potenova/fixtures`) — never real child data.
- **CI** (`.github/workflows/ci.yml`): format → typecheck → test → requirement-trace → evidence.
- **ADRs**, an **architecture overview**, a **threat-model skeleton** (TM-01..50), a
  **conflicts & gaps register**, and the **WP-01 plan** under `docs/`.

## Layout

```
spec/            v2 register imported into the repo (requirements.csv, scope_matrix.csv)
packages/
  contracts/     shared vocabulary: error taxonomy, actor contexts, regions, 32 logical contracts
  domain-core/   executable LOCKED invariants + architecture-fitness tests
  config/        environment + Canadian residency config (fail-closed)
  requirement-trace/  v2 register importer + CI shape gate
  fixtures/      deterministic synthetic data (SYNTHETIC marker)
services/
  api/           modular-monolith host — WP-00 exposes ONLY /healthz and /readyz
docs/            ADRs, architecture, threat model, WP-00 review docs
evidence/        /evidence/<gate>/<req-id>/<run-id>/ — WP-00 run artifacts
```

## Run

```bash
nvm use            # Node 22
npm install
npm run ci         # format:check + typecheck + test + requirement trace
npm run dev -w @potenova/api   # dev probes on :8080 (no child surface)
```

## Guardrails (see CLAUDE.md)

Do not add a child-facing endpoint, tutoring, subscription or production child-data
processing in this repository state. Those are gated behind later work packages and the
safety/validation/consent machinery. Candidate/unapproved AI models never receive
production child data.
