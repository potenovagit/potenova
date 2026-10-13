import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import {
  openDatabase,
  BillingRepository,
  SessionRepository,
  type PotenovaDb,
} from '@potenova/persistence';

/**
 * Child-facing tutoring session vertical slice: the full guard stack
 * (consent fence → entitlement → usage caps → session machine) enforced before a
 * session may go ACTIVE, and a neutral child-initiated stop. Age band is derived
 * from the learner's grade; daily usage comes from the ledger.
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

// Grade 5 → junior band (continuous cap 30, daily 60 in staging).
async function onboard(app: ReturnType<typeof createApp>, opts: { consent: boolean }) {
  await app.request(
    '/families',
    json(owner, { familyId: 'fam1', marketRegion: 'ca-on', legalOwnerGuardianId: 'g1' }),
  );
  await app.request(
    '/families/fam1/learners',
    json(owner, { learnerId: 'kid1', nickname: 'Kid', grade: 5 }),
  );
  if (opts.consent) {
    await app.request(
      '/families/fam1/consent',
      json(owner, { grantId: 'cg1', purpose: 'child_learning', modality: 'text', version: 'v1' }),
    );
  }
}

async function seedEntitlement(db: PotenovaDb, state: string) {
  await new BillingRepository(db).saveEntitlement({
    familyId: 'fam1',
    state,
    tierId: 't1',
    updatedAt: '2026-10-13T00:00:00Z',
  });
}

const start = (body: unknown) => json(child, body);
const today = () => new Date().toISOString().slice(0, 10);

describe('POST /learners/:alias/sessions', () => {
  it('starts an ACTIVE session when consent + entitlement + caps all pass', async () => {
    const { app, db } = freshApp();
    await onboard(app, { consent: true });
    await seedEntitlement(db, 'PAID_ACTIVE');
    const res = await app.request(
      '/learners/kid1/sessions',
      start({ subject: 'math', requestedMinutes: 15 }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.session.state).toBe('ACTIVE');
    expect(body.allowedMinutes).toBe(15);
    expect(body.usage.kind).toBe('ALLOW');
  });

  it('shortens to the (staging) continuous cap when more is requested', async () => {
    const { app, db } = freshApp();
    await onboard(app, { consent: true });
    await seedEntitlement(db, 'PAID_ACTIVE');
    const res = await app.request(
      '/learners/kid1/sessions',
      start({ subject: 'math', requestedMinutes: 45 }),
    );
    const body = await res.json();
    expect(body.usage.kind).toBe('SHORTEN');
    expect(body.allowedMinutes).toBe(30); // junior staging continuous cap
  });

  it('404s when the learner does not exist', async () => {
    const { app, db } = freshApp();
    // family + consent but no learner profile
    await app.request(
      '/families',
      json(owner, { familyId: 'fam1', marketRegion: 'ca-on', legalOwnerGuardianId: 'g1' }),
    );
    await app.request(
      '/families/fam1/consent',
      json(owner, { grantId: 'cg1', purpose: 'child_learning', modality: 'text', version: 'v1' }),
    );
    await seedEntitlement(db, 'PAID_ACTIVE');
    const res = await app.request(
      '/learners/kid1/sessions',
      start({ subject: 'math', requestedMinutes: 15 }),
    );
    expect(res.status).toBe(404);
  });

  it('403s CONSENT_REQUIRED when there is no child_learning grant', async () => {
    const { app, db } = freshApp();
    await onboard(app, { consent: false });
    await seedEntitlement(db, 'PAID_ACTIVE');
    const res = await app.request(
      '/learners/kid1/sessions',
      start({ subject: 'math', requestedMinutes: 15 }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('CONSENT_REQUIRED');
  });

  it('402s ENTITLEMENT_INACTIVE when tutoring is not active', async () => {
    const { app, db } = freshApp();
    await onboard(app, { consent: true });
    await seedEntitlement(db, 'INACTIVE');
    const res = await app.request(
      '/learners/kid1/sessions',
      start({ subject: 'math', requestedMinutes: 15 }),
    );
    expect(res.status).toBe(402);
  });

  it('403s for a non-child actor', async () => {
    const { app, db } = freshApp();
    await onboard(app, { consent: true });
    await seedEntitlement(db, 'PAID_ACTIVE');
    const res = await app.request(
      '/learners/kid1/sessions',
      json(owner, { subject: 'math', requestedMinutes: 15 }),
    );
    expect(res.status).toBe(403);
  });

  it('422s when the daily cap is already spent (from the ledger)', async () => {
    const { app, db } = freshApp();
    await onboard(app, { consent: true });
    await seedEntitlement(db, 'PAID_ACTIVE');
    await new SessionRepository(db).addUsageMinutes('kid1', today(), 60); // junior daily cap
    const res = await app.request(
      '/learners/kid1/sessions',
      start({ subject: 'math', requestedMinutes: 15 }),
    );
    expect(res.status).toBe(422);
  });

  it('accumulates usage across sessions in a day', async () => {
    const { app, db } = freshApp();
    await onboard(app, { consent: true });
    await seedEntitlement(db, 'PAID_ACTIVE');
    // First session reserves 30 (junior continuous cap); second sees 30 used.
    await app.request('/learners/kid1/sessions', start({ subject: 'math', requestedMinutes: 30 }));
    const used = await new SessionRepository(db).getUsageMinutes('kid1', today());
    expect(used).toBe(30);
  });
});

describe('entitlement activation via billing callback (web-demo path)', () => {
  it('a billing-service grant activates entitlement so a child session can start', async () => {
    const { app } = freshApp();
    await onboard(app, { consent: true });
    // No entitlement seeded — the billing callback (as the payment provider) grants it.
    const cb = await app.request(
      '/billing/callbacks',
      json(
        { 'x-actor-type': 'billing_service', 'x-actor-alias': 'bill', 'x-family-alias': 'fam1' },
        { channel: 'web-demo', transactionId: 'tx-1', familyId: 'fam1', kind: 'grant' },
      ),
    );
    expect(cb.status).toBe(200);

    const res = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', requestedMinutes: 15 }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.session.state).toBe('ACTIVE');
    expect(body.next.defaultTaskId).toBeTruthy();
  });
});

describe('POST /learners/:alias/sessions/:id/end', () => {
  it('ending early is neutral — no mastery change', async () => {
    const { app, db } = freshApp();
    await onboard(app, { consent: true });
    await seedEntitlement(db, 'PAID_ACTIVE');
    const started = await (
      await app.request('/learners/kid1/sessions', start({ subject: 'math', requestedMinutes: 15 }))
    ).json();
    const res = await app.request(
      `/learners/kid1/sessions/${started.session.sessionId}/end`,
      json(child, {}),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session.state).toBe('ENDED_EARLY');
    expect(body.masteryChanged).toBe(false);
    // A wrap-up summary accompanies the end (empty observed when nothing was done).
    expect(body.summary.state).toBe('ENDED_EARLY');
    expect(body.summary.observed.attempts).toBe(0);
  });
});
