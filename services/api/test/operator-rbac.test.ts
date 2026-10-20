import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import {
  openDatabase,
  IdentityRepository,
  SafetyRepository,
  type PotenovaDb,
} from '@potenova/persistence';
import { hashIdpSubject } from '@potenova/identity';

/**
 * Real operator identity + least-privilege RBAC (SEC-013, SEC-002).
 *
 * Two surfaces:
 *  - dev mode: the operator role is a header (`x-operator-role`); the permission
 *    guard still fences every privileged route (a read-only operator cannot
 *    mutate; a guardian / role-less operator is refused).
 *  - jwt mode: operators are PRE-REGISTERED in the directory and sign in via
 *    POST /auth/operator/session, which mints a verified, short-lived session
 *    token carrying the role FROM THE DIRECTORY (never the caller). The minted
 *    token is then enforced end-to-end by the auth middleware + RBAC guards.
 */

const base = { APP_ENV: 'staging', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };
const jwtEnv = {
  ...base,
  AUTH_MODE: 'jwt',
  AUTH_JWT_ISSUER: 'potenova-idp',
  AUTH_JWT_AUDIENCE: 'potenova-api',
  AUTH_JWT_SECRET: 'test-operator-rbac-secret',
};

const opHeaders = (role?: string) => ({
  'x-actor-type': 'operator',
  'x-actor-alias': 'op1',
  ...(role ? { 'x-operator-role': role } : {}),
});
const guardian = { 'x-actor-type': 'guardian', 'x-actor-alias': 'g1', 'x-family-alias': 'fam1' };

let dbs: PotenovaDb[] = [];
function freshApp(env: Record<string, string> = base) {
  const db = openDatabase();
  dbs.push(db);
  return { app: createApp({ env, db }), db };
}
afterEach(async () => {
  await Promise.all(dbs.map((d) => d.close()));
  dbs = [];
});

const get = (headers: Record<string, string>) => ({
  method: 'GET',
  headers: { 'content-type': 'application/json', ...headers },
});
const post = (headers: Record<string, string>, body: unknown = {}) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const now = () => new Date().toISOString();

describe('operator RBAC (dev-mode role header)', () => {
  it('a read-only operator may read metrics but may not suspend an account', async () => {
    const { app } = freshApp();
    expect((await app.request('/operator/metrics', get(opHeaders('read_only')))).status).toBe(200);
    const susp = await app.request('/operator/accounts/fam1/suspend', post(opHeaders('read_only')));
    expect(susp.status).toBe(403);
  });

  it('an admin operator may administer accounts', async () => {
    const { app, db } = freshApp();
    await new IdentityRepository(db).saveFamily({
      familyId: 'fam1',
      marketRegion: 'ca-on',
      legalOwnerGuardianId: 'g1',
      status: 'active',
    });
    // Sensitive action → admin must also be elevated (JIT; dev shim flags it).
    const susp = await app.request(
      '/operator/accounts/fam1/suspend',
      post({ ...opHeaders('admin'), 'x-step-up': 'true' }),
    );
    expect(susp.status).toBe(200);
    expect((await susp.json()).status).toBe('suspended');
  });

  it('an operator with no role is refused (fail-closed)', async () => {
    const { app } = freshApp();
    expect((await app.request('/operator/metrics', get(opHeaders()))).status).toBe(403);
  });

  it('a standing (non-elevated) admin is refused a sensitive action (SEC-002 JIT)', async () => {
    const { app } = freshApp();
    const res = await app.request('/operator/accounts/fam1/suspend', post(opHeaders('admin')));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('STEP_UP_REQUIRED');
  });

  it('a guardian cannot reach an operator route', async () => {
    const { app } = freshApp();
    expect((await app.request('/operator/metrics', get(guardian))).status).toBe(403);
  });

  it('only operator:operator_admin may register another operator', async () => {
    const { app } = freshApp();
    const asReadOnly = await app.request(
      '/operator/operators',
      post(opHeaders('read_only'), { idpSubject: 'sub-x', role: 'support' }),
    );
    expect(asReadOnly.status).toBe(403);

    const asAdmin = await app.request(
      '/operator/operators',
      post(
        { ...opHeaders('admin'), 'x-step-up': 'true' },
        { idpSubject: 'sub-x', role: 'support' },
      ),
    );
    expect(asAdmin.status).toBe(201);
    expect((await asAdmin.json()).role).toBe('support');
  });
});

describe('operator sign-in exchange (jwt mode)', () => {
  function seedOperator(db: PotenovaDb, subject: string, role: string, status = 'active') {
    return new IdentityRepository(db).saveOperator({
      subjectHash: hashIdpSubject(subject),
      operatorId: `opr-${role}`,
      role,
      status,
      linkedAt: now(),
    });
  }
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

  it('mints a verified session carrying the directory role, enforced end-to-end', async () => {
    const { app, db } = freshApp(jwtEnv);
    await seedOperator(db, 'op-sub-ro', 'read_only');

    const signin = await app.request(
      '/auth/operator/session',
      post({}, { idpSubject: 'op-sub-ro' }),
    );
    expect(signin.status).toBe(200);
    const body = await signin.json();
    expect(body.actor.role).toBe('read_only');
    expect(typeof body.token).toBe('string');

    // The minted token authenticates and is RBAC-enforced: read ok, mutate denied.
    expect((await app.request('/operator/metrics', get(bearer(body.token)))).status).toBe(200);
    const susp = await app.request('/operator/accounts/fam1/suspend', post(bearer(body.token)));
    expect(susp.status).toBe(403);
  });

  it('an admin must elevate (JIT) before administering an account', async () => {
    const { app, db } = freshApp(jwtEnv);
    await seedOperator(db, 'op-sub-admin', 'admin');
    await new IdentityRepository(db).saveFamily({
      familyId: 'fam1',
      marketRegion: 'ca-on',
      legalOwnerGuardianId: 'g1',
      status: 'active',
    });
    const { token } = await (
      await app.request('/auth/operator/session', post({}, { idpSubject: 'op-sub-admin' }))
    ).json();

    // A standing admin session holds no mutation authority (SEC-002).
    const denied = await app.request('/operator/accounts/fam1/suspend', post(bearer(token)));
    expect(denied.status).toBe(403);
    expect((await denied.json()).code).toBe('STEP_UP_REQUIRED');

    // Read is not sensitive — it works on the standing session.
    expect((await app.request('/operator/metrics', get(bearer(token)))).status).toBe(200);

    // Elevate just-in-time, then the same action succeeds on the elevated token.
    const elevated = await app.request('/auth/operator/step-up', post(bearer(token)));
    expect(elevated.status).toBe(200);
    const { token: stepped } = await elevated.json();
    const ok = await app.request('/operator/accounts/fam1/suspend', post(bearer(stepped)));
    expect(ok.status).toBe(200);
  });

  it('records each JIT elevation on the immutable security audit', async () => {
    const { app, db } = freshApp(jwtEnv);
    await seedOperator(db, 'op-sub-admin2', 'admin');
    const { token } = await (
      await app.request('/auth/operator/session', post({}, { idpSubject: 'op-sub-admin2' }))
    ).json();
    await app.request('/auth/operator/step-up', post(bearer(token)));
    const audit = await new SafetyRepository(db).recentAudit();
    const jit = audit.find((a) => a.action === 'operator_step_up_elevation');
    expect(jit?.approver).toBe('opr-admin');
    expect(jit?.reason).toBe('operator_jit_elevation');
    expect(jit?.outcome).toBe('EXECUTED');
    expect(jit?.expiry).toBeTruthy();
  });

  it('an unregistered subject is refused (no self-provisioning)', async () => {
    const { app } = freshApp(jwtEnv);
    const res = await app.request('/auth/operator/session', post({}, { idpSubject: 'stranger' }));
    expect(res.status).toBe(403);
  });

  it('a deactivated operator cannot sign in', async () => {
    const { app, db } = freshApp(jwtEnv);
    await seedOperator(db, 'op-sub-off', 'admin', 'inactive');
    const res = await app.request('/auth/operator/session', post({}, { idpSubject: 'op-sub-off' }));
    expect(res.status).toBe(403);
  });

  it('a configured bootstrap subject is provisioned as admin on first sign-in', async () => {
    const { app } = freshApp({ ...jwtEnv, OPERATOR_BOOTSTRAP_SUBJECT: 'break-glass' });
    const res = await app.request(
      '/auth/operator/session',
      post({}, { idpSubject: 'break-glass' }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).actor.role).toBe('admin');
  });
});
