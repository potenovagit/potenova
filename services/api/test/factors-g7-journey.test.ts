import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';

/**
 * GCF/LCM journey (Ontario G7 B2.6): determine the greatest common factor and
 * lowest common multiple of two whole numbers, graded by the deterministic
 * Euclid oracle (no model). Synthetic only.
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
  'SK-NS-gcf-pair': '6', // gcf-1: GCF(12,18) = 6
  'SK-NS-lcm-pair': '12', // lcm-1: LCM(4,6) = 12
};
const WRONG: Record<string, string> = {
  'SK-NS-gcf-pair': '36', // reported a common multiple instead of the factor
  'SK-NS-lcm-pair': '2', // reported the GCF instead of the LCM
};

describe('GCF/LCM journey (G7 B2.6)', () => {
  it('coaches the opened factors-g7 skill and grades it correct', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await seedPaidFamily(app, db);

    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'factors-g7', requestedMinutes: 20 }),
    );
    expect(startRes.status).toBe(201);
    const start = await startRes.json();
    const skillId = start.next.skillId as string;
    expect(Object.keys(CORRECT)).toContain(skillId);

    const sessionId = start.session.sessionId as string;
    const taskId = start.next.defaultTaskId as string;
    for (let i = 0; i < 3; i++) {
      const res = await app.request(
        `/learners/kid1/sessions/${sessionId}/answer`,
        json(child, {
          clientSubmissionId: `fac-${i}`,
          taskId,
          answer: CORRECT[skillId],
          representation: 'symbolic',
        }),
      );
      expect(res.status).toBe(201);
      expect((await res.json()).correct).toBe(true);
    }
  });

  it('grades the GCF/LCM-swap error wrong (no model)', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await seedPaidFamily(app, db);

    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'factors-g7', requestedMinutes: 20 }),
    );
    const start = await startRes.json();
    const skillId = start.next.skillId as string;
    const sessionId = start.session.sessionId as string;

    const res = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer`,
      json(child, {
        clientSubmissionId: 'fac-wrong',
        taskId: start.next.defaultTaskId,
        answer: WRONG[skillId],
        representation: 'symbolic',
      }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).correct).toBe(false);
  });
});
