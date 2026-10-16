import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { buildDeps } from '../src/deps';
import { reconcileUsageOnEnd } from '../src/usage';
import {
  openDatabase,
  SessionRepository,
  BillingRepository,
  type PotenovaDb,
} from '@potenova/persistence';

/**
 * Early-end usage reconciliation (ER-09): a session reserves its full allotment
 * up front, and the UNUSED part is refunded when it ends, so stopping early
 * doesn't burn the whole day's time. Reconciliation runs once.
 */

const env = { APP_ENV: 'staging', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };
const owner = {
  'x-actor-type': 'guardian',
  'x-actor-alias': 'g1',
  'x-guardian-role': 'owner',
  'x-family-alias': 'fam1',
};
const child = { 'x-actor-type': 'child', 'x-actor-alias': 'kid1', 'x-family-alias': 'fam1' };

let dbs: PotenovaDb[] = [];
afterEach(async () => {
  await Promise.all(dbs.map((d) => d.close()));
  dbs = [];
});

const json = (headers: Record<string, string>, body?: unknown) => ({
  method: body === undefined ? 'GET' : 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const today = () => new Date().toISOString().slice(0, 10);

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
    updatedAt: '2026-10-16T00:00:00Z',
  });
}

describe('early-end usage reconciliation', () => {
  it('refunds the unused reservation when a child ends early', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await onboard(app, db);
    const usage = new SessionRepository(db);

    const start = await (
      await app.request(
        '/learners/kid1/sessions',
        json(child, { subject: 'math', requestedMinutes: 20 }),
      )
    ).json();
    expect(start.allowedMinutes).toBe(20);
    // The full allotment is reserved against the day.
    expect(await usage.getUsageMinutes('kid1', today())).toBe(20);

    const ended = await (
      await app.request(`/learners/kid1/sessions/${start.session.sessionId}/end`, json(child, {}))
    ).json();
    // Ending immediately refunds almost all of it (≈0 minutes actually used).
    expect(ended.refundedMinutes).toBeGreaterThanOrEqual(19);
    expect(await usage.getUsageMinutes('kid1', today())).toBeLessThanOrEqual(1);
  });

  it('reconciles once — the state guard and missing fields are no-ops', async () => {
    const db = openDatabase();
    dbs.push(db);
    const deps = buildDeps({ env, db });
    const day = today();
    await deps.session.addUsageMinutes('kid1', day, 20);

    // Non-ACTIVE session → no refund.
    expect(
      await reconcileUsageOnEnd(deps, {
        sessionId: 's',
        learnerAlias: 'kid1',
        subject: 'math',
        state: 'COMPLETED',
        startedAt: new Date().toISOString(),
        reservedMinutes: 20,
      }),
    ).toBe(0);

    // ACTIVE but no reservation recorded → no refund.
    expect(
      await reconcileUsageOnEnd(deps, {
        sessionId: 's',
        learnerAlias: 'kid1',
        subject: 'math',
        state: 'ACTIVE',
      }),
    ).toBe(0);

    // ACTIVE, reserved 20, started 10 min ago → actual 10, refund 10.
    const started = new Date(Date.now() - 10 * 60_000).toISOString();
    const refund = await reconcileUsageOnEnd(deps, {
      sessionId: 's',
      learnerAlias: 'kid1',
      subject: 'math',
      state: 'ACTIVE',
      startedAt: started,
      reservedMinutes: 20,
    });
    expect(refund).toBe(10);
    expect(await deps.session.getUsageMinutes('kid1', started.slice(0, 10))).toBe(10);
  });
});
