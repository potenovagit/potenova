import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app';

const env = { APP_ENV: 'dev', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };

describe('WP-00 api surface (CLAUDE.md: no child-facing endpoint in WP-00)', () => {
  const app = createApp(env);

  it('responds to health and readiness probes', () => {
    expect(app.handle({ method: 'GET', path: '/healthz' }).status).toBe(200);
    const ready = app.handle({ method: 'GET', path: '/readyz' });
    expect(ready.status).toBe(200);
  });

  it('exposes NO child-facing / tutoring / AI routes in WP-00', () => {
    for (const path of ['/tutor', '/diagnostic', '/chat', '/ai', '/billing', '/child']) {
      expect(app.handle({ method: 'POST', path }).status).toBe(404);
    }
  });

  it('declares all 14 bounded-domain modules', () => {
    expect(app.modules).toHaveLength(14);
  });
});
