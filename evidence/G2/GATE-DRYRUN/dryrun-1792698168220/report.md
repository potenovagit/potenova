# Stage-2 gate dry-run — dryrun-1792698168220

- **When:** 2026-10-22T19:42:48.220Z
- **Environment:** staging
- **Dataset:** synthetic (no real model, no real child data)
- **Result:** 12/12 PASS — all gates held

This is an end-to-end demonstration that the fail-closed MECHANISMS hold at the HTTP edge on synthetic data, with the policies configured today. It is **not** a specialist sign-off: the privacy/legal (ER-07/ER-10/SEC-009/SEC-012), child-safety (ER-08/ER-09) and accessibility (NFR-06) gates decide the policy VALUES and are not exercised or certified here. No child content is recorded below.

| | Gate | Check | Req IDs | Property | Expected | Observed |
|---|------|-------|---------|----------|----------|----------|
| ✅ | Consent fence | `G-CONSENT-BEFORE` | NFR-04, ER-10 | A child session cannot start before an active child_learning consent grant | 403 CONSENT_REQUIRED | 403 CONSENT_REQUIRED |
| ✅ | Consent fence | `G-CONSENT-AFTER` | NFR-04 | With consent + entitlement, a session starts and is ACTIVE | 201 session ACTIVE | 201 ACTIVE |
| ✅ | Content gate | `G-CONTENT-UNSERVABLE` | SEC-015, AI-001 | The delivery path refuses to serve content for an unservable/unknown skill | 422 POLICY_BLOCKED | 422 POLICY_BLOCKED |
| ✅ | Content gate | `G-CONTENT-VALIDATED` | SEC-015, AI-001 | A validated bank task is delivered (answer key checked by the oracle) | 200 task delivered | 200 |
| ✅ | Canadian residency | `G-RESIDENCY` | NFR-02, AT-55 | A request whose processing region is outside the Canadian allowlist is refused | 451 REGION_DISALLOWED | 451 REGION_DISALLOWED |
| ✅ | Mastery authority | `G-MASTERY-ADVISORY` | TM-07, TM-08, ER-03 | The conceptual-mastery read is advisory (candidate policy, not an approved claim) | 200 policyApproved=false | 200 policyApproved=false |
| ✅ | Mastery authority | `G-MASTERY-ISOLATION` | TM-45, SEC-013 | A guardian cannot read a learner outside their own family (tenant isolation) | 403 FORBIDDEN_ROLE | 403 FORBIDDEN_ROLE |
| ✅ | Consent fence | `G-CONSENT-REVOKE` | NFR-04, ER-10 | After consent is revoked, a new session is blocked again (stop on revocation) | 403 CONSENT_REQUIRED | 403 CONSENT_REQUIRED |
| ✅ | Right to erasure | `G-ERASURE-FIRSTPARTY` | NFR-17, PRIV-005, TM-48 | An operator erasure deletes first-party rows immediately and stays PENDING (fail-closed) until external targets attest | 201 state=PENDING, 0 first-party rows remain | 201 state=PENDING remainingRows=0 |
| ✅ | Right to erasure | `G-ERASURE-COMPLETE` | NFR-17, PRIV-005 | Once every target is attested, the erasure request reads COMPLETE | state=COMPLETE | 200 state=COMPLETE |
| ✅ | Retention schedule | `G-RETENTION-DRYRUN` | ER-07, NFR-17 | A retention dry-run deletes nothing (no class swept, totalActioned=0) — safe to run before an approved schedule exists | dryRun=true, totalActioned=0, no class swept | 200 dryRun=true actioned=0 noneSwept=true |
| ✅ | AI routing | `G-AI-FAILCLOSED` | NFR-02, ER-16 | With no approved in-region provider configured, the eval path fails closed (no model reached) | 503 DEPENDENCY_UNAVAILABLE | 503 DEPENDENCY_UNAVAILABLE |
