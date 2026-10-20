import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import {
  openDatabase,
  BillingRepository,
  NotificationRepository,
  IdentityRepository,
  ErasureRepository,
  type PotenovaDb,
} from '@potenova/persistence';
import { StubNotificationProvider } from '../src/notification-delivery';

/**
 * Notification delivery worker + billing hold/resume consumer. Delivery is
 * fail-closed on the provider (EVIDENCE REQUIRED, residency-bound); the billing
 * consumer applies a hold overlay and never mutates the entitlement machine.
 */

const env = { APP_ENV: 'staging', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };
const operator = {
  'x-actor-type': 'operator',
  'x-actor-alias': 'op1',
  'x-operator-role': 'admin',
  'x-step-up': 'true',
};
const owner = {
  'x-actor-type': 'guardian',
  'x-actor-alias': 'g1',
  'x-guardian-role': 'owner',
  'x-family-alias': 'fam1',
};

let dbs: PotenovaDb[] = [];
function freshApp(opts: { provider?: StubNotificationProvider } = {}) {
  const db = openDatabase();
  dbs.push(db);
  return { app: createApp({ env, db, notificationProvider: opts.provider }), db };
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

async function seedFamily(db: PotenovaDb, familyId = 'fam1') {
  await new IdentityRepository(db).saveFamily({
    familyId,
    marketRegion: 'ca-on',
    legalOwnerGuardianId: 'g1',
    status: 'active',
  });
}
// Suspend enqueues guardian + billing notifications (the outbox source).
async function suspend(app: ReturnType<typeof createApp>) {
  return app.request('/operator/accounts/fam1/suspend', json(operator, {}));
}

describe('notification delivery worker (fail-closed on provider)', () => {
  it('holds every guardian notification when no provider is configured', async () => {
    const { app, db } = freshApp(); // no provider
    await seedFamily(db);
    await suspend(app);

    const res = await app.request('/operator/notifications/dispatch', json(operator, {}));
    expect(res.status).toBe(200);
    const s = await res.json();
    expect(s.provider).toBeNull();
    expect(s.delivered).toBe(0);
    expect(s.heldNoProvider).toBe(1); // the guardian notification
    // The billing signal is NOT delivered here (it's internal to the consumer).
    const pending = await new NotificationRepository(db).listPending();
    expect(pending.map((n) => n.recipient)).toEqual(['billing']);
  });

  it('delivers via an approved in-region provider', async () => {
    const provider = new StubNotificationProvider('stub', 'ca-central');
    const { app, db } = freshApp({ provider });
    await seedFamily(db);
    await suspend(app);

    const s = await (
      await app.request('/operator/notifications/dispatch', json(operator, {}))
    ).json();
    expect(s.delivered).toBe(1);
    expect(provider.sent.map((m) => m.kind)).toEqual(['account_suspended']);
  });

  it('blocks delivery through an out-of-region provider (residency, NFR-02)', async () => {
    const provider = new StubNotificationProvider('offshore', 'us-east');
    const { app, db } = freshApp({ provider });
    await seedFamily(db);
    await suspend(app);

    const s = await (
      await app.request('/operator/notifications/dispatch', json(operator, {}))
    ).json();
    expect(s.delivered).toBe(0);
    expect(s.blockedRegion).toBe(1);
    expect(provider.sent).toHaveLength(0);
  });

  it('holds a notification whose subject account is gone (consent/lifecycle)', async () => {
    const provider = new StubNotificationProvider('stub', 'ca-central');
    const { app, db } = freshApp({ provider });
    await seedFamily(db);
    await suspend(app);
    // The family is erased (consent revoked) before the outbox is drained.
    await new ErasureRepository(db).deleteFamilyIdentity('fam1');

    const s = await (
      await app.request('/operator/notifications/dispatch', json(operator, {}))
    ).json();
    expect(s.delivered).toBe(0);
    expect(s.heldNoSubject).toBe(1);
    expect(provider.sent).toHaveLength(0);
  });

  it('dispatch is a privileged action (a non-elevated admin is refused)', async () => {
    const { app } = freshApp();
    const res = await app.request(
      '/operator/notifications/dispatch',
      json({ 'x-actor-type': 'operator', 'x-actor-alias': 'op1', 'x-operator-role': 'admin' }, {}),
    );
    expect(res.status).toBe(403);
  });
});

describe('billing hold/resume consumer (never mutates entitlement)', () => {
  it('sets a hold on suspend and clears it on reactivate, leaving entitlement untouched', async () => {
    const { app, db } = freshApp();
    await seedFamily(db);
    const billing = new BillingRepository(db);
    await billing.saveEntitlement({
      familyId: 'fam1',
      state: 'PAID_ACTIVE',
      tierId: 't1',
      updatedAt: '2026-10-13T00:00:00Z',
    });

    await suspend(app);
    const held = await (
      await app.request('/operator/billing/process-signals', json(operator, {}))
    ).json();
    expect(held.held).toBe(1);
    expect(await billing.getHold('fam1')).toBe(true);
    // Entitlement state is unchanged — the hold is an overlay, not a transition.
    expect((await billing.getEntitlement('fam1'))?.state).toBe('PAID_ACTIVE');

    await app.request('/operator/accounts/fam1/reactivate', json(operator, {}));
    const resumed = await (
      await app.request('/operator/billing/process-signals', json(operator, {}))
    ).json();
    expect(resumed.resumed).toBe(1);
    expect(await billing.getHold('fam1')).toBe(false);
    expect((await billing.getEntitlement('fam1'))?.state).toBe('PAID_ACTIVE');
  });

  it('surfaces the billing-hold count in operator metrics', async () => {
    const { app, db } = freshApp();
    await seedFamily(db);
    await suspend(app);
    await app.request('/operator/billing/process-signals', json(operator, {}));
    const m = await (await app.request('/operator/metrics', json(operator))).json();
    expect(m.billing.holds).toBe(1);
  });
});
