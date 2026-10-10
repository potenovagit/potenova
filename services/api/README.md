# Potenova API (Stage 2)

Hono HTTP service (ADR-0018) over the shared database (ADR-0017) and the domain
guards. Every child-data / AI path enforces the LOCKED invariants at the edge:
consent fence, content gate, Canadian residency, role/actor authorization, and
mastery-stays-derived. Synthetic data only; no real model is called (ADR-0005).

## Run locally (dev)

From the repo root:

```
npm run dev:api
```

No env vars, no build step — the dev entry (`src/dev.ts`) sets safe dev defaults
and resolves workspace packages from source. Serves on `http://localhost:8080`
with an in-memory database.

## Configuration

`server.ts` is the production entry and has **no defaults** — it fails closed if
config is missing. Config is supplied by the environment:

| Variable          | Purpose                                                                          |
| ----------------- | -------------------------------------------------------------------------------- |
| `APP_ENV`         | `dev` / `staging` / `prod` (required)                                            |
| `PRIMARY_REGION`  | Canadian region, e.g. `ca-central` (required)                                    |
| `DR_REGION`       | DR region, e.g. `ca-east` (required)                                             |
| `PORT`            | Listen port (default 8080)                                                       |
| `DATABASE_URL`    | Managed Postgres connection string → Postgres backend. If unset, PGlite is used. |
| `DATABASE_SSL`    | `false` to disable TLS (local only); TLS is on by default.                       |
| `POTENOVA_DB_DIR` | On-disk PGlite directory (when `DATABASE_URL` is unset).                         |

Health endpoints: `GET /healthz`, `GET /readyz`.

## Container

```
docker build -f services/api/Dockerfile -t potenova-api .
docker run -p 8080:8080 \
  -e APP_ENV=prod -e PRIMARY_REGION=ca-central -e DR_REGION=ca-east \
  -e DATABASE_URL="postgres://USER:PASS@HOST:5432/potenova?sslmode=require" \
  potenova-api
```

The image bakes in no config or secrets. Deployment target is Azure Container Apps
in a Canadian region (ADR-0019); secrets come from Key Vault.
