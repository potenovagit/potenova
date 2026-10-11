import { serve } from '@hono/node-server';
import { loadConfig } from '@potenova/config';
import { createApp } from './app';

/**
 * Dev HTTP host. Serves the Hono app on Node. The database directory comes from
 * POTENOVA_DB_DIR (a local PGlite dir in dev; the managed Postgres connection in
 * prod via ADR-0017). Nothing child-facing calls a real model yet.
 */
const app = createApp({ webRoot: process.env.POTENOVA_WEB_ROOT });
const config = loadConfig(process.env);
const port = Number(process.env.PORT ?? 8080);

serve({ fetch: app.fetch, port }, () => {
  // eslint-disable-next-line no-console
  console.log(`potenova api on :${port} [${config.environment}, ${config.primaryRegion}]`);
});
