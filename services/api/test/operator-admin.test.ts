import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import {
  openDatabase,
  BillingRepository,
  SafetyRepository,
  type PotenovaDb,
} from '@potenova/persistence';

/**
 * Operator/admin console (synthetic, pre-G2): read-only roll-up metrics and
 * per-account suspend/reactivate. Suspend takes effect at the edge — a suspended
 * family is refused a new child session before any processing — and every
 * suspend/reactivate is written to the immutable security audit. Operator-only.
 */

const env = { APP_ENV: 'staging', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };

const operator = { 'x-actor-type': 'operator', 'x-actor-alias': 'op1', 'x-operator-role': 'admin' };
const owner = {
  'x-actor-type': 'guardian',
  'x-actor-alias': 'g1',
  'x-guardian-role': 'owner',
  'x-family-alias': 'fam1',
};
const child = { 'x-actor-type': 'child', 'x-actor-alias': 'kid1', 'x-family-alias': 'fam1' };

let dbs: PotenovaDb[] = [];
function freshApp() {
  const db = openDatabase();
  dbs.push(db);
  return { app: createApp({ env, db }), db };
}
afterEach(async () => {
  await Promise.all(dbs.map((d) => d.close()));
  dbs = [];
});

const json = (headers: Record<string, string>, body?: unknown) => ({
  method: body === undefined ? 'GET' : 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

async function onboard(app: ReturnType<typeof createApp>, db: PotenovaDb) {
  await app.request(
    '/families',
    json(owner, { familyId: 'fam1', marketRegion: 'ca-on', legalOwnerGuardianId: 'g1' }),
  );
  await app.request(
    '/families/fam1/learners',
    json(owner, { learnerId: 'kid1', nickname: 'Kid', grade: 5 }),
  );
  await app.request(
    '/families/fam1/consent',
    json(owner, { grantId: 'cg1', purpose: 'child_learning', modality: 'text', version: 'v1' }),
  );
  await new BillingRepository(db).saveEntitlement({
    familyId: 'fam1',
    state: 'PAID_ACTIVE',
    tierId: 't1',
    updatedAt: '2026-10-13T00:00:00Z',
  });
}

const startSession = () => json(child, { subject: 'math', requestedMinutes: 15 });

describe('GET /operator/metrics', () => {
  it('rolls up account + session counts and the AI posture (read-only)', async () => {
    const { app, db } = freshApp();
    await onboard(app, db);
    await app.request('/learners/kid1/sessions', startSession());

    const res = await app.request('/operator/metrics', json(operator));
    expect(res.status).toBe(200);
    const m = await res.json();
    expect(m.accounts).toEqual({ families: 1, guardians: 1, learners: 1 });
    expect(m.sessions.total).toBe(1);
    expect(m.sessions.active).toBe(1);
    // No real model is wired pre-G2 → nothing is production-approved.
    expect(m.ai.anyModelApprovedForProduction).toBe(false);
  });

  it('is operator-only (a guardian is forbidden)', async () => {
    const { app } = freshApp();
    const res = await app.request('/operator/metrics', json(guardianRead()));
    expect(res.status).toBe(403);
  });
});

function guardianRead() {
  return { 'x-actor-type': 'guardian', 'x-actor-alias': 'g1', 'x-family-alias': 'fam1' };
}

describe('POST /operator/accounts/:id/suspend | /reactivate', () => {
  it('suspend refuses a new child session at the edge; reactivate restores it', async () => {
    const { app, db } = freshApp();
    await onboard(app, db);

    // Active to begin with.
    const first = await app.request('/learners/kid1/sessions', startSession());
    expect(first.status).toBe(201);

    // Suspend the family → the next child session is POLICY_BLOCKED (422).
    const susp = await app.request('/operator/accounts/fam1/suspend', json(operator, {}));
    expect(susp.status).toBe(200);
    expect((await susp.json()).status).toBe('suspended');

    const blocked = await app.request('/learners/kid1/sessions', startSession());
    expect(blocked.status).toBe(422);
    expect((await blocked.json()).code).toBe('POLICY_BLOCKED');

    // Reactivate → a child session may start again.
    const react = await app.request('/operator/accounts/fam1/reactivate', json(operator, {}));
    expect(react.status).toBe(200);
    expect((await react.json()).status).toBe('active');

    const ok = await app.request('/learners/kid1/sessions', startSession());
    expect(ok.status).toBe(201);
  });

  it('records each suspend/reactivate on the immutable security audit', async () => {
    const { app, db } = freshApp();
    await onboard(app, db);

    await app.request('/operator/accounts/fam1/suspend', json(operator, {}));
    await app.request('/operator/accounts/fam1/reactivate', json(operator, {}));

    const audit = await new SafetyRepository(db).recentAudit();
    const actions = audit.filter((a) => a.object === 'family:fam1').map((a) => a.action);
    expect(actions).toContain('account_suspend');
    expect(actions).toContain('account_reactivate');
    const suspend = audit.find((a) => a.action === 'account_suspend');
    expect(suspend?.approver).toBe('op1');
    expect(suspend?.outcome).toBe('EXECUTED');
    expect(suspend?.reason).toBe('account_administration');
  });

  it('404s an unknown family', async () => {
    const { app } = freshApp();
    const res = await app.request('/operator/accounts/nope/suspend', json(operator, {}));
    expect(res.status).toBe(404);
  });

  it('is operator-only (a guardian cannot suspend)', async () => {
    const { app, db } = freshApp();
    await onboard(app, db);
    const res = await app.request('/operator/accounts/fam1/suspend', json(guardianRead(), {}));
    expect(res.status).toBe(403);
  });
});
