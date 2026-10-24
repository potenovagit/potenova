import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';

/**
 * Percent-of-a-number journey (Ontario G6 exp 8): determine a percent of a whole
 * number, graded by the deterministic percent-of oracle (no model). The oracle
 * fails closed on non-whole-number results, so only clean whole-number items
 * reach a child. Synthetic only.
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

async function seedPaidFamily(app: ReturnType<typeof createApp>, db: PotenovaDb) {
  await app.request(
    '/families',
    json(owner, { familyId: 'fam1', marketRegion: 'ca-on', legalOwnerGuardianId: 'g1' }),
  );
  await app.request(
    '/families/fam1/learners',
    json(owner, { learnerId: 'kid1', nickname: 'Kid', grade: 6 }),
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

describe('percent-of-a-number journey (G6 exp 8)', () => {
  it('coaches SK-NS-percent-of and grades the value', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await seedPaidFamily(app, db);

    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'percents-g6', requestedMinutes: 20 }),
    );
    expect(startRes.status).toBe(201);
    const start = await startRes.json();
    expect(start.next.skillId).toBe('SK-NS-percent-of');

    const sessionId = start.session.sessionId as string;
    const taskId = start.next.defaultTaskId as string; // pof-1: 25% of 80 = 20
    const reps = ['area-model', 'symbolic', 'area-model'];
    for (let i = 0; i < reps.length; i++) {
      const res = await app.request(
        `/learners/kid1/sessions/${sessionId}/answer`,
        json(child, {
          clientSubmissionId: `pof-${i}`,
          taskId,
          answer: '20',
          representation: reps[i],
        }),
      );
      expect(res.status).toBe(201);
      expect((await res.json()).correct).toBe(true);
    }
  });

  it('grades the divide-by-10 place-value slip wrong (25% of 80 ≠ 200, no model)', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await seedPaidFamily(app, db);

    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'percents-g6', requestedMinutes: 20 }),
    );
    const start = await startRes.json();
    const sessionId = start.session.sessionId as string;

    const res = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer`,
      json(child, {
        clientSubmissionId: 'pof-slip',
        taskId: start.next.defaultTaskId,
        answer: '200', // divided by 10 instead of 100
        representation: 'symbolic',
      }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).correct).toBe(false);
  });
});
