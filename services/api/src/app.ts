import { Hono } from 'hono';
import { DOMAIN_MODULES } from './modules';
import { buildDeps, type BuildDepsOptions, type Deps } from './deps';
import { onError } from './errors';
import { registerFamilies } from './routes/families';
import { registerLearning } from './routes/learning';
import { registerCommerce } from './routes/commerce';
import { registerOps } from './routes/ops';

/**
 * Potenova API service (Stage 2 Step 2; ADR-0018).
 *
 * A Hono app wired to the shared PotenovaDb repositories and the domain guards.
 * Every child-data / AI path enforces the LOCKED invariants at the edge: the
 * consent fence (no processing before consent), the content gate (nothing
 * unvalidated reaches a child), Canadian residency, role/actor authorization and
 * the rule that only evidence producers write observations (mastery stays
 * derived). No real model is called here — that arrives with the AI provider
 * (Stage 2 Step 3). Runs on synthetic data only.
 */
export function createApp(opts: BuildDepsOptions = {}): Hono {
  const deps: Deps = buildDeps(opts);
  const app = new Hono();
  app.onError(onError);

  app.get('/healthz', (c) => c.json({ status: 'ok' }));
  app.get('/readyz', (c) =>
    c.json({
      status: 'ready',
      environment: deps.config.environment,
      primaryRegion: deps.config.primaryRegion,
      drRegion: deps.config.drRegion,
      modules: DOMAIN_MODULES.length,
    }),
  );

  registerFamilies(app, deps);
  registerLearning(app, deps);
  registerCommerce(app, deps);
  registerOps(app, deps);
  return app;
}

export { DOMAIN_MODULES } from './modules';
export { buildDeps } from './deps';
export type { Deps } from './deps';
