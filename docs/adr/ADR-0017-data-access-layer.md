# ADR-0017 — Data access layer and local database runtime

- **Status:** Accepted (implementation decision, reversible) — 2026-10-10
- **Context:** WP-00 §Persistence / Stage 2 Step 1
- **Relates to:** ADR-0002 (PostgreSQL + immutable evidence), LRN-003, SEC-002

## Decision

The persistence layer uses **Drizzle ORM** (a thin, typed SQL query builder) over
**PostgreSQL**. A single Drizzle schema serves every environment; only the driver
and connection change:

- **Dev / test / demo:** **PGlite** (`@electric-sql/pglite`) — the real PostgreSQL
  engine compiled to WebAssembly, running in-process. It persists to a local
  directory and needs no server install, so contributors and CI exercise genuine
  Postgres SQL with zero setup.
- **Production (and staged envs):** **managed PostgreSQL in the Canadian region**
  (ADR-0002), reached through Drizzle's `node-postgres` driver. Residency and
  backup posture are unchanged by this ADR.

Repositories are **append-only by construction**: they expose insert and select
only — no update or delete — so the immutable-evidence non-negotiable is enforced
by the type surface, not just convention. A correction is a new row, never a
mutation. Inserts are idempotent on the primary key.

Schema DDL is applied at repository init for dev/test; production schema changes
go through versioned migrations with the reconciliation/rollback plan required by
OPS-014 (to be wired when the managed database is provisioned).

## Alternatives considered

- **Raw `pg` driver + hand-written SQL** — no abstraction, but loses typed schema
  and makes the dev/prod parity above harder to keep honest.
- **A heavyweight ORM (e.g. an Active Record style)** — more magic, heavier
  runtime, and a poorer fit for an append-only, replay-based evidence model.
- **A separate dev database engine (SQLite)** — removes real Postgres parity; a
  dialect gap would hide bugs until production.

## Consequences

- Repository methods are asynchronous (the honest shape of real I/O); the pure
  domain logic (projection, policy) stays synchronous and untouched.
- Reversible: switching query layer or dev engine is contained to this package.
- Still EVIDENCE REQUIRED elsewhere: connection/residency provisioning, backup
  drills (ADR-0010 / ER-06/07) and production migration tooling are set up when
  the managed database is stood up.

## Implementation status — 2026-10-10

The managed-Postgres backend is now **implemented and verified**, not just planned.
`PotenovaDb` selects a backend from the environment (`openDatabaseFromEnv`):
`DATABASE_URL` → node-postgres against a real server (TLS on unless
`DATABASE_SSL=false`); otherwise PGlite (on-disk or in-memory). The driver
(`drizzle-orm/node-postgres`, `pg`) is wired behind the same `PotenovaDrizzle`
interface, so every repository is byte-for-byte identical across backends.

Verified locally against **PostgreSQL 16**: the evidence repository and the full
API (consent fence → evidence ingest → derived projection) ran unchanged with
`DATABASE_URL` set, and the row was confirmed present in Postgres directly — the
"only the connection changes" claim holds. A guarded integration test
(`test/postgres-backend.test.ts`) exercises this and skips automatically when no
`DATABASE_URL` is present, so CI without a database stays green. Production schema
migration tooling (vs. the init-time DDL used for dev/test) is still set up when the
managed database is provisioned (ADR-0019).
