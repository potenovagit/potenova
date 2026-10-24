import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';

/**
 * Unlike-denominator fraction add/subtract journey (Ontario G6 exp 10): graded
 * by the deterministic value oracle (cross-multiplication, no model). The G5
 * like-denominator oracle is a distinct kind and untouched. Synthetic only.
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

describe('unlike-denominator fraction add/subtract journey (G6 exp 10)', () => {
  it('coaches SK-NS-fraction-addsub-unlike and accepts any equivalent form', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await seedPaidFamily(app, db);

    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'fractions-g6', requestedMinutes: 20 }),
    );
    expect(startRes.status).toBe(201);
    const start = await startRes.json();
    expect(start.next.skillId).toBe('SK-NS-fraction-addsub-unlike');

    const sessionId = start.session.sessionId as string;
    const taskId = start.next.defaultTaskId as string; // fau-1: 1/2 + 1/3 = 5/6
    // Mix of the common-denominator form and the reduced form — both are 5/6.
    const answers = ['5/6', '10/12', '5/6'];
    const reps = ['symbolic', 'area-model', 'symbolic'];
    for (let i = 0; i < answers.length; i++) {
      const res = await app.request(
        `/learners/kid1/sessions/${sessionId}/answer`,
        json(child, {
          clientSubmissionId: `frac6-${i}`,
          taskId,
          answer: answers[i],
          representation: reps[i],
        }),
      );
      expect(res.status).toBe(201);
      expect((await res.json()).correct).toBe(true);
    }
  });

  it('grades the added-straight-across error wrong (1/2 + 1/3 ≠ 2/5, no model)', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await seedPaidFamily(app, db);

    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'fractions-g6', requestedMinutes: 20 }),
    );
    const start = await startRes.json();
    const sessionId = start.session.sessionId as string;

    const res = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer`,
      json(child, {
        clientSubmissionId: 'frac6-across',
        taskId: start.next.defaultTaskId,
        answer: '2/5', // added numerators and denominators straight across
        representation: 'symbolic',
      }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).correct).toBe(false);
  });
});
