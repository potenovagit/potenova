import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, type PotenovaDb } from '@potenova/persistence';
import { decodeJwt } from 'jose';

/**
 * Step-up re-verification for sensitive guardian actions (ADR-0008, AT-24/52):
 * a data export / erasure request is refused until the session has stepped up.
 * The elevation is short-lived and, in production, synthetic step-up is disabled
 * (fail-closed).
 */

const base = { PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };
const owner = {
  'x-actor-type': 'guardian',
  'x-actor-alias': 'g1',
  'x-guardian-role': 'owner',
  'x-family-alias': 'fam1',
};
const jwtEnv = {
  ...base,
  APP_ENV: 'staging',
  AUTH_MODE: 'jwt',
  AUTH_JWT_ISSUER: 'potenova-idp',
  AUTH_JWT_AUDIENCE: 'potenova-api',
  AUTH_JWT_SECRET: 'test-session-secret',
};

let dbs: PotenovaDb[] = [];
afterEach(async () => {
  await Promise.all(dbs.map((d) => d.close()));
  dbs = [];
});

const appWith = (env: Record<string, string>) => {
  const db = openDatabase();
  dbs.push(db);
  return createApp({ env, db });
};
const json = (headers: Record<string, string>, body?: unknown) => ({
  method: body === undefined ? 'GET' : 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

describe('step-up re-verification (guardian sensitive actions)', () => {
  it('refuses a data request without step-up, allows it with step-up (dev shim)', async () => {
    const app = appWith({ ...base, APP_ENV: 'staging' }); // dev header mode
    await app.request(
      '/families',
      json(owner, { familyId: 'fam1', marketRegion: 'ca-on', legalOwnerGuardianId: 'g1' }),
    );
    await app.request(
      '/families/fam1/learners',
      json(owner, { learnerId: 'kid1', nickname: 'Kid', grade: 5 }),
    );

    // No step-up → refused with the distinct code the client can act on.
    const denied = await app.request(
      '/learners/kid1/data-requests',
      json(owner, { kind: 'access' }),
    );
    expect(denied.status).toBe(403);
    expect((await denied.json()).code).toBe('STEP_UP_REQUIRED');

    // With step-up satisfied → the request is accepted.
    const ok = await app.request(
      '/learners/kid1/data-requests',
      json({ ...owner, 'x-step-up': 'true' }, { kind: 'erasure' }),
    );
    expect(ok.status).toBe(201);
    expect((await ok.json()).kind).toBe('erasure');
  });

  it('elevates a session to a short-lived step_up token via /auth/step-up', async () => {
    const app = appWith(jwtEnv);
    const signin = await (
      await app.request(
        '/auth/session',
        json({ 'content-type': 'application/json' }, { idpSubject: 'entra-sub-su' }),
      )
    ).json();
    expect(decodeJwt(signin.token).step_up).toBe(false);

    const res = await app.request(
      '/auth/step-up',
      json({ authorization: `Bearer ${signin.token}` }, {}),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.actor.stepUp).toBe(true);

    const claims = decodeJwt(body.token);
    expect(claims.step_up).toBe(true);
    // Time-boxed: the elevated window is at most 5 minutes.
    expect((claims.exp as number) - (claims.iat as number)).toBeLessThanOrEqual(300);
  });

  it('the elevated token authenticates a sensitive action end to end (jwt mode)', async () => {
    const app = appWith(jwtEnv);
    const signin = await (
      await app.request(
        '/auth/session',
        json({ 'content-type': 'application/json' }, { idpSubject: 'entra-sub-e2e' }),
      )
    ).json();
    const fam = signin.actor.familyId as string;
    const g = signin.actor.guardianId as string;
    const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

    await app.request(
      '/families/' + fam + '/learners',
      json(bearer(signin.token), { learnerId: 'kid-e2e', nickname: 'Kid', grade: 5 }),
    );

    // Base session cannot export — not stepped up.
    const denied = await app.request(
      '/learners/kid-e2e/data-requests',
      json(bearer(signin.token), { kind: 'access' }),
    );
    expect(denied.status).toBe(403);
    expect((await denied.json()).code).toBe('STEP_UP_REQUIRED');

    // Step up, then the elevated token is accepted.
    const elevated = await (
      await app.request('/auth/step-up', json(bearer(signin.token), {}))
    ).json();
    const ok = await app.request(
      '/learners/kid-e2e/data-requests',
      json(bearer(elevated.token), { kind: 'access' }),
    );
    expect(ok.status).toBe(201);
    void g;
  });

  it('refuses step-up without a current session, and is fail-closed in production', async () => {
    const app = appWith(jwtEnv);
    const noBearer = await app.request(
      '/auth/step-up',
      json({ 'content-type': 'application/json' }, {}),
    );
    expect(noBearer.status).toBe(401);
    expect((await noBearer.json()).code).toBe('AUTH_REQUIRED');

    const prod = appWith({
      ...base,
      APP_ENV: 'prod',
      AUTH_JWT_ISSUER: 'potenova-idp',
      AUTH_JWT_AUDIENCE: 'potenova-api',
      AUTH_JWT_SECRET: 'prod-secret',
    });
    const inProd = await prod.request(
      '/auth/step-up',
      json({ authorization: 'Bearer anything' }, {}),
    );
    expect(inProd.status).toBe(422);
    expect((await inProd.json()).code).toBe('POLICY_BLOCKED');
  });
});
