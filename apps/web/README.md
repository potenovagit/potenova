# Potenova web app (Stage 2 Step 4)

A runnable React (Vite) UI over the live API — a **parent console** (family,
consent, learner, dashboard) and a **child practice screen**. Synthetic data
only; no account or cloud needed. Real tutoring content arrives with the approved
AI provider (deferred, pre-beta).

## Run it (two terminals)

Terminal 1 — the API:

```
APP_ENV=dev PRIMARY_REGION=ca-central DR_REGION=ca-east PORT=8080 \
  npm run dev --workspace @potenova/api
```

Terminal 2 — the web app:

```
npm run dev:web
```

Then open http://localhost:5173. The browser calls the API same-origin under
`/api/*`; Vite proxies that to the API on :8080 (so there is no CORS setup in dev).

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
