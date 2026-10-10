# Potenova web app (Stage 2 Step 4)

A runnable React (Vite) UI over the live API — a **parent console** (family,
consent, learner, dashboard) and a **child practice screen**. Synthetic data
only; no account or cloud needed. Real tutoring content arrives with the approved
AI provider (deferred, pre-beta).

## Run it

From the repo root, once:

```
npm install
```

Then two terminals (identical on Windows PowerShell, macOS and Linux — no
environment variables to set):

**Terminal 1 — the API**

```
npm run dev:api
```

Wait for `potenova api on :8080 [dev, ca-central]`, then leave it running.

**Terminal 2 — the web app**

```
npm run dev:web
```

Open **http://localhost:5173**. The top status line should read
"API ready · dev · ca-central · 14 modules" — that means the browser is talking
to the API. The browser calls the API same-origin under `/api/*`; Vite proxies
that to the API on :8080, so there is no CORS setup in dev.

Stop either server with `Ctrl+C`.

### Notes

- `npm run dev:api` runs the dev entry (`services/api/src/dev.ts`): it sets safe
  dev defaults and resolves the workspace packages from source, so **no build
  step and no env vars are needed**. Production uses `server.ts`, which has no
  defaults and fails closed on missing config.
- The dev database is in-memory, so restarting the API resets any family/learner
  you created. Set `POTENOVA_DB_DIR` to a folder to persist it.

## How auth works here

This is the Stage-2 dev identity shim (ADR-0008): the client sends the actor
headers the API already enforces (a guardian **owner** for parent actions, an
**evidence-producer** for practice). Production identity comes from the managed
IdP. The app never sets mastery — it writes evidence and reads the derived
projection, exactly like every other client.

## What it demonstrates

- The **consent fence**: practice is refused with `CONSENT_REQUIRED` until a
  `child_learning` grant exists.
- **Ontario G1–8 only**: adding a learner outside that range is blocked.
- **Derived mastery**: the dashboard standings come from observed evidence, never
  a hand-set value or a predicted report-card grade.
- **Age-band UI** (LUX-001): larger targets and copy for younger learners.

Mobile (React Native) reuses the same shared view-model logic and API; it is
built later because it needs a device/simulator to run.
