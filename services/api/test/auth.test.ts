import { describe, it, expect, afterEach } from 'vitest';
import { SignJWT } from 'jose';
import { createApp } from '../src/app';
import { openDatabase, type PotenovaDb } from '@potenova/persistence';

/**
 * Real-authentication layer (ADR-0008): in jwt mode the API trusts only a
 * cryptographically verified bearer token, not request headers. These exercise
 * the verifier end to end against a route behind the auth middleware.
 */
const SECRET = 'unit-test-signing-secret';
const ISSUER = 'https://issuer.test';
const AUDIENCE = 'potenova-api';

const env = {
  APP_ENV: 'staging',
  PRIMARY_REGION: 'ca-central',
  DR_REGION: 'ca-east',
  AUTH_MODE: 'jwt',
  AUTH_JWT_ISSUER: ISSUER,
  AUTH_JWT_AUDIENCE: AUDIENCE,
  AUTH_JWT_SECRET: SECRET,
};

let dbs: PotenovaDb[] = [];
function freshApp() {
  const db = openDatabase();
  dbs.push(db);
  return createApp({ env, db });
}
afterEach(async () => {
  await Promise.all(dbs.map((d) => d.close()));
  dbs = [];
});

async function mint(
  claims: Record<string, unknown>,
  opts: { secret?: string; expired?: boolean } = {},
) {
  const key = new TextEncoder().encode(opts.secret ?? SECRET);
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(opts.expired ? '-1m' : '5m')
    .sign(key);
}

// Content delivery gate — behind the auth middleware, needs no DB write.
const deliver = (token?: string) =>
  ({
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      candidate: { candidateId: 'c1', verdict: 'PASS', validationRecordRef: 'vr:val@1:c1:PASS' },
    }),
  }) satisfies RequestInit;

describe('JWT authentication (AUTH_MODE=jwt)', () => {
  it('accepts a validly signed token and authorizes the request', async () => {
    const app = freshApp();
    const token = await mint({
      actor_type: 'evidence_producer',
      actor_alias: 'ep1',
      processing_region: 'ca-central',
    });
    const r = await app.request('/content/deliver', deliver(token));
    expect(r.status).toBe(200);
    expect((await r.json()).outcome.kind).toBe('DELIVER');
  });

  it('rejects a request with no bearer token (401)', async () => {
    const app = freshApp();
    const r = await app.request('/content/deliver', deliver());
    expect(r.status).toBe(401);
    expect((await r.json()).code).toBe('AUTH_REQUIRED');
  });

  it('rejects a token signed with the wrong key (401)', async () => {
    const app = freshApp();
    const token = await mint(
      { actor_type: 'evidence_producer', actor_alias: 'ep1' },
      { secret: 'the-wrong-secret' },
    );
    const r = await app.request('/content/deliver', deliver(token));
    expect(r.status).toBe(401);
  });

  it('rejects an expired token (401)', async () => {
    const app = freshApp();
    const token = await mint(
      { actor_type: 'evidence_producer', actor_alias: 'ep1' },
      { expired: true },
    );
    const r = await app.request('/content/deliver', deliver(token));
    expect(r.status).toBe(401);
  });

  it('fails closed when the token lacks a valid actor identity (401)', async () => {
    const app = freshApp();
    const token = await mint({ actor_alias: 'nobody' }); // no actor_type
    const r = await app.request('/content/deliver', deliver(token));
    expect(r.status).toBe(401);
  });

  it('still enforces Canadian residency from the verified claim (451)', async () => {
    const app = freshApp();
    const token = await mint({
      actor_type: 'evidence_producer',
      actor_alias: 'ep1',
      processing_region: 'us-east-1',
    });
    const r = await app.request('/content/deliver', deliver(token));
    expect(r.status).toBe(451);
  });

  it('leaves the web UI and health endpoints public (no token needed)', async () => {
    const app = freshApp();
    expect((await app.request('/healthz')).status).toBe(200);
    expect((await app.request('/readyz')).status).toBe(200);
  });
});
