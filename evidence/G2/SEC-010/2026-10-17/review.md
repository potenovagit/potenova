# SEC-010 — Internal security review (code portion)

- **Run:** 2026-10-17 · **Reviewer field:** _unsigned_ (owner to sign)
- **Scope of THIS run:** the "in code" controls of `Internal_Security_Review_Checklist.md`,
  executed against the repo at the tip of `main` plus this branch. Infra/Azure,
  DR/backup, and the external privacy/vendor controls are **out of scope here** —
  they need the Azure subscription (SEC-002/004/007/008), the DR runbook
  (`DR_BIA_and_SLO_Worksheet.md`), or counsel (SEC-009/012/016).
- **Baseline:** `npm run ci` green — 552 tests pass, 2 skipped (126 files); format,
  typecheck, requirement-trace and both builds clean.
- **Result:** **Pass-with-conditions.** One production dependency finding fixed
  (hono); one tracked (drizzle, not reachable); SAST/secret/IaC scanning wired
  (dependency audit blocking; the rest report-only pending owner enforcement).

## Findings

### F-1 (fixed) — hono production dependency, multiple high-severity advisories
`services/api` depended on `hono@4.6.14`, which carries numerous advisories
including improper-authorization, JWT algorithm-confusion/auth-bypass, body-limit
bypass and `parseBody` prototype pollution. **Fixed:** bumped to `hono@4.13.13`
(non-breaking, same major). API + auth (incl. JWT mode) + route tests re-run
green; `npm audit --omit=dev` no longer reports hono.

### F-2 (tracked, not a beta blocker) — drizzle-orm advisory, not reachable
`drizzle-orm@0.36.4` is flagged high for "SQL injection via improperly escaped
SQL identifiers" (`<0.45.2`). The fix (`0.45.4`) is **semver-major** (nine 0.x
minors) and the advisory is **not reachable in our code** — persistence uses
static schema column references only; there is no `sql.identifier(...)` or
`.raw(...)` with user-controlled identifiers anywhere in `packages/persistence/src`.
**Recommendation:** schedule a dedicated drizzle upgrade PR with full persistence
regression before beta; not forced in this review to avoid destabilising the data
layer for an unreachable issue. The CI critical-gate (below) does not trip on it
(it is "high", not "critical").

## Control-by-control (code portion)

| Control | Verdict | Evidence |
|---|---|---|
| **SEC-005** CI security gates | **Partial → improved** | Production dependency audit now a **blocking** CI step (`npm audit --omit=dev --audit-level=critical`, `.github/workflows/ci.yml`); secret scan (gitleaks) + IaC scan (checkov on `infra/azure`) added **report-only** in `.github/workflows/security.yml`. SAST (CodeQL) deferred — needs GitHub Advanced Security on a private repo (owner/licensing decision). |
| **SEC-006** config recoverable | **Pass (code)** | All infra is version-controlled Bicep under `infra/azure` (`main.bicep` + per-env `*.bicepparam`); ADR-0020. Drift from Azure not checkable here. |
| **SEC-013** least-privilege at domain boundaries | **Pass** | Actor-type gates: `requireActorType` across routes; mastery is derived-only via `@potenova/domain-core/mastery-authority` (no UI/parent/tutor write path). Negative tests: `packages/identity/test/authorization.test.ts`, `packages/domain-core/test/mastery-authority.test.ts`, `services/api/test/auth.test.ts`. |
| **SEC-014** multi-tenant isolation (IDOR) | **Pass** | `assertOwnsLearner` / family-alias checks; cross-family access returns 403 with no side channel. Negative tests: `services/api/test/parent-controls.test.ts`, `parent-usage-dsar.test.ts`, `privacy-family-erasure.test.ts`, `lessons.test.ts`, `sessions.test.ts`. |
| **SEC-015** prompt-injection / upload resistance | **Pass (synthetic)** | Content gate (`@potenova/domain-core/content-gate`) delivers only PASS-with-signed-record or an approved fallback, else BLOCK; task delivery is gated (`gateTask`). Tests: `packages/domain-core/test/content-gate.test.ts`, `packages/content/test/{validation,quarantine,pipeline}.test.ts`. Real handwriting/upload not built yet (unchanged from a11y/G2 notes). |
| **SEC-016** third-party processor control | **Deferred** | Vendor register (Microsoft + any others) is a privacy-counsel/owner artifact — not in code. |
| **NFR-02** model routing policy | **Pass** | AI gateway refuses unapproved model / region / capability. Tests: `packages/ai-gateway/test/router.test.ts`, `packages/domain-core/test/ai-gateway-policy.test.ts`. No real model wired before G2. |
| **NFR-04** consent enforcement | **Pass** | Consent fence blocks processing without an active `child_learning` grant; revocation stops processing. Tests: `packages/domain-core/test/consent-fence.test.ts`; API consent-required (403) across `sessions`, `diagnostic-run`, `placement`, `lessons`, `coaching`. |
| **NFR-20** logging minimisation | **Pass (code)** | Only 6 `console.*` call sites in shipped `src` (API server startup banner, `eval-cli`, requirement-trace CLI); none log child content or identifiers. Production log/trace sinks (Azure) to be confirmed in the infra review. |

## Out of scope for this run (owner / infra / external)
SEC-001 (classification register → PIA), SEC-002 (JIT elevation), SEC-003 (dual
authorization), SEC-004 (tamper-resistant audit separation), SEC-007/008
(availability/DR + backups → DR worksheet), SEC-009/012 (PIA + readiness gate →
counsel), SEC-016 (vendor register). The mandatory AI safety suite items
(NFR-01/02/04/20) are covered above where code-checkable; NFR-01 red-team
regression breadth remains safety-owner-owned.

## Conditions to clear before "Pass"
1. Owner decision on SAST (enable GHAS/CodeQL or accept semgrep OSS) and on making
   the report-only scans blocking after first-run review.
2. Scheduled drizzle-orm upgrade PR with persistence regression (F-2).
3. The infra/Azure and DR/backup controls, run against the subscription.
