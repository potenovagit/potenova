import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';

/**
 * Decimals-to-thousandths journey (Ontario G6 exp 3/4): compare/order decimals
 * to thousandths and round to the nearest hundredth, graded by the deterministic
 * float-free thousandths oracle (no model). The G4 tenths and G5 hundredths
 * oracles are untouched. Synthetic only.
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

// The default task for whichever skill the planner opens first.
const CORRECT_ANSWER: Record<string, string> = {
  'SK-NS-decimal-thousandth-compare': 'lt', // dtc-1: 2.475 < 2.500
  'SK-NS-decimal-round-hundredth': '2.48', // drh-1: 2.475 → 2.48
};
const WRONG_ANSWER: Record<string, string> = {
  'SK-NS-decimal-thousandth-compare': 'gt', // longer-looks-bigger trap
  'SK-NS-decimal-round-hundredth': '2.47', // truncation instead of rounding
};

describe('decimals-to-thousandths journey (G6 exp 3/4)', () => {
  it('coaches the opened decimals-g6 skill and grades it correct', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await seedPaidFamily(app, db);

    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'decimals-g6', requestedMinutes: 20 }),
    );
    expect(startRes.status).toBe(201);
    const start = await startRes.json();
    const skillId = start.next.skillId as string;
    expect(Object.keys(CORRECT_ANSWER)).toContain(skillId);

    const sessionId = start.session.sessionId as string;
    const taskId = start.next.defaultTaskId as string;
    const reps = ['symbolic', 'number-line', 'symbolic'];
    for (let i = 0; i < reps.length; i++) {
      const res = await app.request(
        `/learners/kid1/sessions/${sessionId}/answer`,
        json(child, {
          clientSubmissionId: `dec6-${i}`,
          taskId,
          answer: CORRECT_ANSWER[skillId],
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
      json(child, { subject: 'math', strand: 'decimals-g6', requestedMinutes: 20 }),
    );
    const start = await startRes.json();
    const skillId = start.next.skillId as string;
    const sessionId = start.session.sessionId as string;

    const res = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer`,
      json(child, {
        clientSubmissionId: 'dec6-trap',
        taskId: start.next.defaultTaskId,
        answer: WRONG_ANSWER[skillId],
        representation: 'symbolic',
      }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).correct).toBe(false);
  });
});
