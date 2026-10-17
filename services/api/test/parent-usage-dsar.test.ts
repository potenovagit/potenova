import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';

/**
 * Guardian self-service: today's usage (derived, read-only) and data-subject
 * request intake (DSAR). A guardian can request access/export or erasure of their
 * own child's data; the request is recorded for the privacy team / operator to
 * fulfil. The guardian never executes an erasure here.
 */

const env = { APP_ENV: 'staging', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };
const owner = {
  'x-actor-type': 'guardian',
  'x-actor-alias': 'g1',
  'x-guardian-role': 'owner',
  'x-family-alias': 'fam1',
};
const otherGuardian = {
  'x-actor-type': 'guardian',
  'x-actor-alias': 'g9',
  'x-guardian-role': 'owner',
  'x-family-alias': 'fam9',
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
const put = (headers: Record<string, string>, body: unknown) => ({
  method: 'PUT',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

async function onboard() {
  const db = openDatabase();
  dbs.push(db);
  const app = createApp({ env, db });
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
  return app;
}

describe('guardian usage read', () => {
  it('reports minutes reserved by a session and the parent daily limit', async () => {
    const app = await onboard();

    // Before any session, nothing used and no limit set.
    const before = await (await app.request('/learners/kid1/usage', json(owner))).json();
    expect(before.usedTodayMinutes).toBe(0);
    expect(before.maxDailyMinutes).toBeNull();

    // A session reserves its allotted minutes against today's ledger.
    const start = await (
      await app.request(
        '/learners/kid1/sessions',
        json(child, { subject: 'math', requestedMinutes: 20 }),
      )
    ).json();
    const after = await (await app.request('/learners/kid1/usage', json(owner))).json();
    expect(after.usedTodayMinutes).toBe(start.allowedMinutes);
    expect(after.usedTodayMinutes).toBeGreaterThan(0);

    // A parent daily limit is surfaced once set.
    await app.request('/learners/kid1/preferences', put(owner, { caps: { maxDailyMinutes: 40 } }));
    const limited = await (await app.request('/learners/kid1/usage', json(owner))).json();
    expect(limited.maxDailyMinutes).toBe(40);
  });

  it('is tenant-isolated — another family guardian cannot read usage', async () => {
    const app = await onboard();
    await app.request(
      '/families',
      json(otherGuardian, { familyId: 'fam9', marketRegion: 'ca-on', legalOwnerGuardianId: 'g9' }),
    );
    const read = await app.request('/learners/kid1/usage', json(otherGuardian));
    expect(read.status).toBe(403);
  });
});

describe('guardian DSAR intake', () => {
  it('records an access request and reads its status back', async () => {
    const app = await onboard();
    const res = await app.request('/learners/kid1/data-requests', json(owner, { kind: 'access' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.kind).toBe('access');
    expect(body.state).toBe('received');
    expect(typeof body.requestId).toBe('string');

    const status = await (
      await app.request(`/learners/kid1/data-requests/${body.requestId}`, json(owner))
    ).json();
    expect(status.kind).toBe('access');
    expect(status.state).toBe('RECEIVED');
  });

  it('records an erasure request without executing it', async () => {
    const app = await onboard();
    const res = await app.request(
      '/learners/kid1/data-requests',
      json(owner, { kind: 'erasure', note: 'closing the account' }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.kind).toBe('erasure');

    // The learner's data is still present — intake does not delete.
    const dash = await app.request('/learners/kid1/dashboard', json(owner));
    expect(dash.status).toBe(200);
  });

  it('rejects an unknown kind', async () => {
    const app = await onboard();
    const bad = await app.request('/learners/kid1/data-requests', json(owner, { kind: 'sell' }));
    expect(bad.status).toBe(422);
  });

  it('is tenant-isolated and 404s an unknown request', async () => {
    const app = await onboard();
    await app.request(
      '/families',
      json(otherGuardian, { familyId: 'fam9', marketRegion: 'ca-on', legalOwnerGuardianId: 'g9' }),
    );
    const write = await app.request(
      '/learners/kid1/data-requests',
      json(otherGuardian, { kind: 'access' }),
    );
    expect(write.status).toBe(403);

    const missing = await app.request('/learners/kid1/data-requests/nope', json(owner));
    expect(missing.status).toBe(404);
  });
});
