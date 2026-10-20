import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import {
  openDatabase,
  IdentityRepository,
  SafetyRepository,
  type PotenovaDb,
} from '@potenova/persistence';

/**
 * Dual authorization for the highest-risk operator actions (SEC-003): one
 * operator requests, a DIFFERENT elevated operator approves, then the action
 * executes. No single operator can independently export bulk child data or
 * disable a safety control. Builds on RBAC (SEC-013) + JIT elevation (SEC-002).
 *
 * Dev mode: identity + role + elevation come from headers (x-operator-role,
 * x-step-up). Two distinct operators are two distinct x-actor-alias values.
 */

const env = { APP_ENV: 'staging', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };

// Two distinct elevated admin operators (maker + checker).
const opA = {
  'x-actor-type': 'operator',
  'x-actor-alias': 'op-A',
  'x-operator-role': 'admin',
  'x-step-up': 'true',
};
const opB = { ...opA, 'x-actor-alias': 'op-B' };
const opReadOnly = {
  'x-actor-type': 'operator',
  'x-actor-alias': 'op-RO',
  'x-operator-role': 'read_only',
};
const opAdminNoStep = {
  'x-actor-type': 'operator',
  'x-actor-alias': 'op-A',
  'x-operator-role': 'admin',
};

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

const post = (headers: Record<string, string>, body: unknown = {}) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const get = (headers: Record<string, string>) => ({
  method: 'GET',
  headers: { 'content-type': 'application/json', ...headers },
});
const now = () => new Date().toISOString();

async function request(
  app: ReturnType<typeof createApp>,
  who: Record<string, string>,
  body: unknown,
) {
  const res = await app.request('/operator/dual-auth/requests', post(who, body));
  return { res, body: (await res.json()) as { requestId?: string; status?: string } };
}

describe('dual authorization — request + approve', () => {
  it('one operator requests and a different operator approves + executes (bulk export)', async () => {
    const { app, db } = freshApp();
    const id = new IdentityRepository(db);
    await id.saveFamily({
      familyId: 'fam1',
      marketRegion: 'ca-on',
      legalOwnerGuardianId: 'g1',
      status: 'active',
    });
    for (const learnerId of ['kid1', 'kid2']) {
      await id.saveLearner({
        learnerId,
        familyId: 'fam1',
        nickname: 'Kid',
        grade: 5,
        ageBand: 'g4-6',
        lifecycleStatus: 'active',
      });
    }

    const { res, body } = await request(app, opA, {
      action: 'child_data.bulk_export',
      params: { familyId: 'fam1' },
      reason: 'ACC-approved bulk export',
    });
    expect(res.status).toBe(201);
    expect(body.status).toBe('PENDING');

    const approve = await app.request(
      `/operator/dual-auth/requests/${body.requestId}/approve`,
      post(opB),
    );
    expect(approve.status).toBe(200);
    const out = await approve.json();
    expect(out.status).toBe('CONSUMED');
    expect(out.result.kind).toBe('export_manifest');
    expect(out.result.learnerCount).toBe(2);
  });

  it('the requester cannot approve their own request (separation of duty)', async () => {
    const { app } = freshApp();
    const { body } = await request(app, opA, {
      action: 'safety_control.disable',
      params: { control: 'ai_generation' },
      reason: 'incident',
    });
    const selfApprove = await app.request(
      `/operator/dual-auth/requests/${body.requestId}/approve`,
      post(opA),
    );
    expect(selfApprove.status).toBe(403);
  });

  it('a safety-control disable needs two operators, then takes effect', async () => {
    const { app } = freshApp();
    const { body } = await request(app, opA, {
      action: 'safety_control.disable',
      params: { control: 'ai_generation' },
      reason: 'contain a misbehaving capability',
    });
    const approve = await app.request(
      `/operator/dual-auth/requests/${body.requestId}/approve`,
      post(opB),
    );
    expect(approve.status).toBe(200);
    // The kill switch is now disabled — a real, readable effect of the approval.
    const ks = await app.request('/operator/kill-switch/ai_generation', get(opA));
    expect((await ks.json()).active).toBe(false);
  });

  it('records both the request and the approval, by distinct operators', async () => {
    const { app, db } = freshApp();
    const { body } = await request(app, opA, {
      action: 'safety_control.disable',
      params: { control: 'vision_input' },
      reason: 'incident',
    });
    await app.request(`/operator/dual-auth/requests/${body.requestId}/approve`, post(opB));
    const audit = await new SafetyRepository(db).recentAudit();
    const requested = audit.find((a) => a.action.startsWith('dual_auth_requested'));
    const approved = audit.find((a) => a.action.startsWith('dual_auth_approved'));
    expect(requested?.approver).toBe('op-A');
    expect(approved?.approver).toBe('op-B');
    expect(approved?.outcome).toBe('EXECUTED');
  });
});

describe('dual authorization — fail-closed guards', () => {
  it('a read-only operator cannot even request (RBAC)', async () => {
    const { app } = freshApp();
    const { res } = await request(app, opReadOnly, {
      action: 'child_data.bulk_export',
      params: { familyId: 'fam1' },
      reason: 'x',
    });
    expect(res.status).toBe(403);
  });

  it('a non-elevated admin cannot request (JIT still applies)', async () => {
    const { app } = freshApp();
    const { res, body } = await request(app, opAdminNoStep, {
      action: 'child_data.bulk_export',
      params: { familyId: 'fam1' },
      reason: 'x',
    });
    expect(res.status).toBe(403);
    expect((body as { code?: string }).code).toBe('STEP_UP_REQUIRED');
  });

  it('an undefined action is refused', async () => {
    const { app } = freshApp();
    const { res } = await request(app, opA, { action: 'account.suspend', params: {}, reason: 'x' });
    expect(res.status).toBe(422);
  });

  it('a denied request cannot then be approved', async () => {
    const { app } = freshApp();
    const { body } = await request(app, opA, {
      action: 'safety_control.disable',
      params: { control: 'ai_generation' },
      reason: 'x',
    });
    const deny = await app.request(
      `/operator/dual-auth/requests/${body.requestId}/deny`,
      post(opB),
    );
    expect(deny.status).toBe(200);
    expect((await deny.json()).status).toBe('DENIED');
    const approve = await app.request(
      `/operator/dual-auth/requests/${body.requestId}/approve`,
      post(opB),
    );
    expect(approve.status).toBe(422);
  });

  it('an expired request cannot be approved', async () => {
    const { app, db } = freshApp();
    // Seed a PENDING request that already expired.
    await new SafetyRepository(db).createDualAuthRequest({
      requestId: 'da-expired',
      action: 'safety_control.disable',
      params: JSON.stringify({ control: 'ai_generation' }),
      reason: 'stale',
      requestedBy: 'op-A',
      requestedAt: '2026-10-19T00:00:00Z',
      status: 'PENDING',
      approvedBy: null,
      decidedAt: null,
      expiresAt: '2026-10-19T00:05:00Z',
    });
    const approve = await app.request('/operator/dual-auth/requests/da-expired/approve', post(opB));
    expect(approve.status).toBe(422);
  });
});
