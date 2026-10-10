# CLAUDE.md — Potenova repository engineering rules

This repo implements Potenova from the **v2.0 authoritative specification** (see the
attached project / `spec/`). These rules bind any contributor, human or agent.

## Read first

`00_README.md`, `01_Authoritative_Master.md`, `requirements.csv`, `09_Governance_Decisions_Scope.md`,
`08_Claude_Implementation_Work_Packages.md`, then the relevant domain specs. `LOCKED` is
authoritative; `EVIDENCE REQUIRED` is an unresolved decision with an owner and gate;
`IMPLEMENTATION DECISION` belongs in an ADR with a reversible choice.

## Non-negotiable (fail-closed)

- Never use real production child data in non-production or unapproved-model evaluation.
- Never let tutor UI, parent or billing set learner mastery. Immutable evidence + versioned
  shadow/replay are authoritative (`@potenova/domain-core/mastery-authority`).
- Never let unvalidated generated content or a free-form tutor turn reach a child
  (`@potenova/domain-core/content-gate`).
- Never route a model that is unapproved, out-of-envelope, or outside the Canadian region
  allowlist (`@potenova/domain-core/ai-gateway-policy`).
- No processing before consent; stop on revocation (`@potenova/domain-core/consent-fence`).
- Canadian processing residency across AI / voice / vision / analytics / logs / backup / support.
- Math/English coaching only — not general chat, not homework completion, not a companion.
- Never invent a price, trial length, age cap, provider, retention period, quality threshold
  or SLO as a final decision — those are EVIDENCE REQUIRED.

## Workflow (per work package)

1. Read master + relevant domain specs + requirement IDs.
2. Write/update an ADR for any undecided technology choice.
3. Define interfaces, schemas, threat surfaces, migration impact.
4. Implement the smallest verifiable slice with synthetic fixtures and negative tests.
5. `npm run ci` green; produce evidence under `evidence/<gate>/<req-id>/<run-id>/`.
6. Report deviations and residual risks; **wait for approval** before changing any LOCKED
   requirement (use the deviation protocol — DEV record).

## Scope boundary — superseded for Stage 2 (owner-approved; ADR-0018)

The original WP-00 boundary (below) barred any child-facing endpoint. WP-00→WP-13
are complete, and the product owner has approved **Stage 2 (make it a running
app)**: a persistent database (ADR-0017) and an HTTP API (ADR-0018). The API is
exercised on **synthetic data only** and still honours every non-negotiable at
the edge — consent fence, content gate, Canadian residency, role/actor authz,
and mastery-stays-derived. No real model is wired yet, and no real child data is
processed before Gate G2. The original boundary, retained for history:

> No child-facing endpoint, tutoring, diagnostic, subscription or production child-data
> processing. Build in dependency order: WP-00 → WP-01/02 → WP-03/04 → …
