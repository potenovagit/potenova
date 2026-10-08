import { loadConfig, type PotenovaConfig } from '@potenova/config';
import { DOMAIN_MODULES } from './modules';

/**
 * WP-00 application surface. Intentionally minimal:
 *   - operational probes only (/healthz, /readyz)
 *   - NO child-facing, tutoring, diagnostic, billing or AI endpoints
 *
 * The handler is a plain function so it can be hosted by any HTTP layer chosen
 * in ADR-0001 without committing the framework now.
 */
export interface HttpRequestLike {
  readonly method: string;
  readonly path: string;
}
export interface HttpResponseLike {
  readonly status: number;
  readonly body: unknown;
}

export interface App {
  readonly config: PotenovaConfig;
  readonly modules: typeof DOMAIN_MODULES;
  handle(req: HttpRequestLike): HttpResponseLike;
}

export function createApp(env: NodeJS.ProcessEnv = process.env): App {
  const config = loadConfig(env);

  function handle(req: HttpRequestLike): HttpResponseLike {
    if (req.method === 'GET' && req.path === '/healthz') {
      return { status: 200, body: { status: 'ok' } };
    }
    if (req.method === 'GET' && req.path === '/readyz') {
      return {
        status: 200,
        body: {
          status: 'ready',
          environment: config.environment,
          primaryRegion: config.primaryRegion,
          drRegion: config.drRegion,
          modules: DOMAIN_MODULES.length,
        },
      };
    }
    // Everything else is intentionally absent in WP-00.
    return { status: 404, body: { code: 'NOT_FOUND' } };
  }

  return { config, modules: DOMAIN_MODULES, handle };
}
