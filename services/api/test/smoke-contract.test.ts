import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, type PotenovaDb } from '@potenova/persistence';

/**
 * Guards the post-deploy smoke contract (infra/smoke.mjs) in local CI. The smoke
 * check runs only against a live deployment during `promote`, so a route change
 * that breaks it (e.g. adding an authz requirement to /operator/status) would
 * otherwise pass `npm run ci` and fail only after merge. These assertions mirror
 * exactly what smoke.mjs sends, so such drift is caught here instead.
 */

// The exact headers infra/smoke.mjs presents to /operator/status.
const SMOKE_OPERATOR_HEADERS = {
  'x-actor-type': 'operator',
  'x-actor-alias': 'smoke',
  'x-operator-role': 'read_only',
};

let dbs: PotenovaDb[] = [];
function appWith(appEnv: string) {
  const db = openDatabase();
  dbs.push(db);
  const env = { APP_ENV: appEnv, PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };
  return createApp({ env, db });
}
afterEach(async () => {
  await Promise.all(dbs.map((d) => d.close()));
  dbs = [];
});
const get = (h: Record<string, string> = {}) => ({ method: 'GET', headers: h });

describe('smoke contract (infra/smoke.mjs)', () => {
  it('/readyz is 200 and reports a Canadian primary region', async () => {
    const app = appWith('dev');
    const res = await app.request('/readyz', get());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(String(body.primaryRegion)).toMatch(/^ca-/);
  });

  it('/operator/status answers 200 to the smoke operator headers', async () => {
    const app = appWith('dev');
    const res = await app.request('/operator/status', get(SMOKE_OPERATOR_HEADERS));
    expect(res.status).toBe(200);
  });

  it('a prod-config app reports the fail-closed posture (prodReady=false) pre-G2', async () => {
    const app = appWith('prod');
    const res = await app.request('/operator/status', get(SMOKE_OPERATOR_HEADERS));
    expect(res.status).toBe(200);
    expect((await res.json()).prodReady).toBe(false);
  });
});
