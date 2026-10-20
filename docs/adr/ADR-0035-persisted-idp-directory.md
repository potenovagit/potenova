# ADR-0035 — Persisted guardian↔IdP-subject directory

- Status: Accepted (DRAFT / synthetic-only)
- Date: 2026-10-19
- Owner: Identity / Security
- Related: ADR-0008 (identity), ADR-0033 (sign-in exchange, scaffold directory);
  ACC-001/002, SEC-001, PRIV-001.

## Context

ADR-0033 mapped a verified IdP subject to Potenova's family/guardian ids with a **deterministic
hash derivation** (`guardianRefForSubject`) — no stored mapping, and the ids were a function of
the subject. That ADR noted the production directory would be a persisted subject→guardian row
set behind the same seam. This ADR makes that real.

## Decision

- **`idp_directory` table** — `subject_hash` (PK) → `guardian_id`, `family_id`, `linked_at`.
  The key is a **SHA-256 hash of the opaque IdP subject** (`hashIdpSubject`), so the raw subject
  is never stored and cannot be recovered from the directory. The ids it points at are now
  **freshly minted** (`fam-<uuid>` / `gdn-<uuid>`), independent of the subject — the mapping is
  explicit data, not a computation.
- **`IdentityRepository.linkIdpSubject` / `getGuardianBySubject`** — the link is written once on
  first sign-in (first-writer-wins via `ON CONFLICT DO NOTHING`, so a concurrent duplicate is a
  no-op); a returning subject resolves to its stored ids.
- **`/auth/session`** now looks the subject up in the directory and provisions
  (family + owner guardian + directory link) only on a miss — replacing the derive-then-check
  logic. `guardianRefForSubject` is removed; `hashIdpSubject` is the only subject-derived value
  and it is just the storage key.

## Consequences

- The subject→guardian link is durable, auditable data rather than an implicit hash, and
  Potenova's ids no longer encode the IdP subject — a cleaner privacy and data-model posture.
- Idempotent sign-in is now a real directory lookup (survives restart, shared across the managed
  Postgres and PGlite backends identically), not a recomputation.
- Still guardians-only, synthetic, pre-G2; no raw subject or IdP PII stored; authorization stays
  in Potenova's modules. A real Entra tenant, Canadian directory residency (ER-16) and the
  consent-verification coupling (ER-10) remain pre-G2.
