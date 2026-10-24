import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';

/**
 * Perfect-squares journey (Ontario G7 B1.2): identify a perfect square and
 * determine its root, graded by the deterministic integer oracle (no model).
 * The root skill fails closed on non-perfect-squares. Synthetic only.
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
    json(owner, { learnerId: 'kid1', nickname: 'Kid', grade: 7 }),
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

// The default task's correct answer for whichever skill the planner opens first.
const CORRECT: Record<string, string> = {
  'SK-NS-is-perfect-square': 'yes', // ips-1: 64 is a perfect square
  'SK-NS-perfect-square-root': '12', // psr-1: √144 = 12
};
const WRONG: Record<string, string> = {
  'SK-NS-is-perfect-square': 'no',
  'SK-NS-perfect-square-root': '72', // halved instead of rooted
};

describe('perfect-squares journey (G7 B1.2)', () => {
  it('coaches the opened squares-g7 skill and grades it correct', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await seedPaidFamily(app, db);

    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'squares-g7', requestedMinutes: 20 }),
    );
    expect(startRes.status).toBe(201);
    const start = await startRes.json();
    const skillId = start.next.skillId as string;
    expect(Object.keys(CORRECT)).toContain(skillId);

    const sessionId = start.session.sessionId as string;
    const taskId = start.next.defaultTaskId as string;
    const reps = ['symbolic', 'area-model', 'symbolic'];
    for (let i = 0; i < reps.length; i++) {
      const res = await app.request(
        `/learners/kid1/sessions/${sessionId}/answer`,
        json(child, {
          clientSubmissionId: `sq-${i}`,
          taskId,
          answer: CORRECT[skillId],
          representation: reps[i],
        }),
      );
      expect(res.status).toBe(201);
      expect((await res.json()).correct).toBe(true);
    }
  });

  it('grades the matching misconception wrong (no model)', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await seedPaidFamily(app, db);

    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'squares-g7', requestedMinutes: 20 }),
    );
    const start = await startRes.json();
    const skillId = start.next.skillId as string;
    const sessionId = start.session.sessionId as string;

    const res = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer`,
      json(child, {
        clientSubmissionId: 'sq-wrong',
        taskId: start.next.defaultTaskId,
        answer: WRONG[skillId],
        representation: 'symbolic',
      }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).correct).toBe(false);
  });
});
