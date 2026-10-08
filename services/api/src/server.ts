import { createServer } from 'node:http';
import { createApp } from './app';

/**
 * Dev-only HTTP host for the WP-00 probes. Uses the Node stdlib server so the
 * scaffold runs with zero web-framework commitment (framework = ADR-0001).
 */
const app = createApp();
const port = Number(process.env.PORT ?? 8080);

const server = createServer((req, res) => {
  const result = app.handle({ method: req.method ?? 'GET', path: (req.url ?? '/').split('?')[0]! });
  res.writeHead(result.status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(result.body));
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`potenova api (WP-00 probes only) on :${port} [${app.config.environment}]`);
});
