import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';

/**
 * Decimals-to-hundredths journey (Ontario G5 exp 4/5): compare decimals to
 * hundredths and round to the nearest tenth, graded by the float-free hundredths
 * oracles (no model). The round item takes a decimal-string answer. Synthetic only.
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

describe('decimals-to-hundredths journey (G5 exp 4/5)', () => {
  it('coaches a decimal skill and grades a correct answer', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await seedPaidFamily(app, db);

    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'decimals-g5', requestedMinutes: 20 }),
    );
    expect(startRes.status).toBe(201);
    const start = await startRes.json();
    const sessionId = start.session.sessionId as string;
    const skillId = start.next.skillId as string;
    expect(['SK-NS-decimal-hundredth-compare', 'SK-NS-decimal-round-tenth']).toContain(skillId);

    // dhc-1 is 2.47 < 2.50 → "lt"; drt-1 is 2.47 → nearest tenth → "2.5".
    const correctFor: Record<string, string> = {
      'SK-NS-decimal-hundredth-compare': 'lt',
      'SK-NS-decimal-round-tenth': '2.5',
    };
    const taskId = start.next.defaultTaskId as string;
    const reps = ['number-line', 'symbolic', 'number-line'];
    let last: { correct: boolean } | undefined;
    for (let i = 0; i < reps.length; i++) {
      const res = await app.request(
        `/learners/kid1/sessions/${sessionId}/answer`,
        json(child, {
          clientSubmissionId: `dec5-${i}`,
          taskId,
          answer: correctFor[skillId],
          representation: reps[i],
        }),
      );
      expect(res.status).toBe(201);
      last = await res.json();
      expect(last!.correct).toBe(true);
    }
  });

  it('grades the longer-looks-bigger / truncation error wrong (no model)', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await seedPaidFamily(app, db);

    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'decimals-g5', requestedMinutes: 20 }),
    );
    const start = await startRes.json();
    const sessionId = start.session.sessionId as string;
    const skillId = start.next.skillId as string;

    // dhc-1 true relation is lt → "gt" wrong; drt-1 is 2.5 → "2.4" (truncation) wrong.
    const wrongFor: Record<string, string> = {
      'SK-NS-decimal-hundredth-compare': 'gt',
      'SK-NS-decimal-round-tenth': '2.4',
    };
    const res = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer`,
      json(child, {
        clientSubmissionId: 'wrong-dec5',
        taskId: start.next.defaultTaskId,
        answer: wrongFor[skillId],
        representation: 'symbolic',
      }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).correct).toBe(false);
  });
});
