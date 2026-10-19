import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, type PotenovaDb } from '@potenova/persistence';
import { guardianRefForSubject } from '@potenova/identity';
import { SignJWT, decodeJwt } from 'jose';

/**
 * Guardian sign-in exchange (ADR-0008): the IdP verifies a guardian, Potenova
 * provisions its own family/guardian records for that subject and issues a
 * short-lived, capability-scoped session token. Synthetic sign-in is dev/staging
 * only and FAIL-CLOSED in production; children never reach this path.
 */

const base = { PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };
// jwt-mode env so the issued session token is also verifiable downstream.
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
const json = (body?: unknown, headers: Record<string, string> = {}) => ({
  method: body === undefined ? 'GET' : 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

describe('guardian sign-in exchange', () => {
  it('synthetic sign-in provisions a guardian and issues a scoped session token', async () => {
    const app = appWith(jwtEnv);
    const res = await app.request('/auth/session', json({ idpSubject: 'entra-sub-abc' }));
    expect(res.status).toBe(200);
    const body = await res.json();

    const { familyId, guardianId } = guardianRefForSubject('entra-sub-abc');
    expect(body.actor).toMatchObject({
      actorType: 'guardian',
      guardianId,
      familyId,
      role: 'owner',
      stepUp: false,
    });
    expect(body.provisioned).toBe(true);
    expect(body.tokenType).toBe('Bearer');

    // The token is a guardian, owner, family-scoped capability set — never a child.
    const claims = decodeJwt(body.token);
    expect(claims.actor_type).toBe('guardian');
    expect(claims.guardian_role).toBe('owner');
    expect(claims.step_up).toBe(false);
    expect(claims.family_alias).toBe(familyId);
    expect(claims.sub).toBe(guardianId);
    expect(typeof claims.exp).toBe('number');
    // No IdP PII (e.g. email) is embedded.
    expect(claims.email).toBeUndefined();
  });

  it('is idempotent — a returning subject maps to the same family, provisioned once', async () => {
    const app = appWith(jwtEnv);
    const first = await (
      await app.request('/auth/session', json({ idpSubject: 'entra-sub-repeat' }))
    ).json();
    const second = await (
      await app.request('/auth/session', json({ idpSubject: 'entra-sub-repeat' }))
    ).json();
    expect(first.provisioned).toBe(true);
    expect(second.provisioned).toBe(false);
    expect(second.actor).toMatchObject(first.actor);
  });

  it('the issued token authenticates a downstream guardian action', async () => {
    const app = appWith(jwtEnv);
    const { token, actor } = await (
      await app.request('/auth/session', json({ idpSubject: 'entra-sub-xyz' }))
    ).json();

    // Use the session token as a Bearer credential to add a learner to the
    // provisioned family — proves it carries guardian + owner + family scope.
    const res = await app.request(
      `/families/${actor.familyId}/learners`,
      json({ learnerId: 'lnr-1', nickname: 'Kid', grade: 5 }, { authorization: `Bearer ${token}` }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).ageBand).toBe('junior');
  });

  it('verifies a real (Entra-shaped) identity token and maps its subject', async () => {
    const env = {
      ...jwtEnv,
      ENTRA_ISSUER: 'https://entra.example/ca',
      ENTRA_AUDIENCE: 'potenova-clients',
      ENTRA_SECRET: 'entra-test-signing-key',
    };
    const app = appWith(env);
    const entraToken = await new SignJWT({ email: 'guardian@example.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('entra-oid-999')
      .setIssuer('https://entra.example/ca')
      .setAudience('potenova-clients')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode('entra-test-signing-key'));

    const res = await app.request(
      '/auth/session',
      json({}, { authorization: `Bearer ${entraToken}` }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const { guardianId } = guardianRefForSubject('entra-oid-999');
    expect(body.actor.guardianId).toBe(guardianId);
  });

  it('rejects an invalid identity token, and refuses a bearer when no IdP is configured', async () => {
    // No ENTRA_* configured → a bearer cannot be verified → dependency unavailable.
    const noIdp = appWith(jwtEnv);
    const r1 = await noIdp.request('/auth/session', json({}, { authorization: 'Bearer anything' }));
    expect(r1.status).toBe(503);
    expect((await r1.json()).code).toBe('DEPENDENCY_UNAVAILABLE');

    // Configured, but the token is signed with the wrong key → auth required.
    const app = appWith({
      ...jwtEnv,
      ENTRA_ISSUER: 'https://entra.example/ca',
      ENTRA_AUDIENCE: 'potenova-clients',
      ENTRA_SECRET: 'the-right-key',
    });
    const bad = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('x')
      .setIssuer('https://entra.example/ca')
      .setAudience('potenova-clients')
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode('the-WRONG-key'));
    const r2 = await app.request('/auth/session', json({}, { authorization: `Bearer ${bad}` }));
    expect(r2.status).toBe(401);
    expect((await r2.json()).code).toBe('AUTH_REQUIRED');
  });

  it('fails closed: synthetic sign-in is refused in production', async () => {
    const app = appWith({
      ...base,
      APP_ENV: 'prod',
      AUTH_JWT_ISSUER: 'potenova-idp',
      AUTH_JWT_AUDIENCE: 'potenova-api',
      AUTH_JWT_SECRET: 'prod-secret',
    });
    const res = await app.request('/auth/session', json({ idpSubject: 'entra-sub-prod' }));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe('POLICY_BLOCKED');
  });
});
