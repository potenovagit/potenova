import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';

/**
 * Division-with-remainder journey (Ontario G4 exp 14): give the quotient and the
 * remainder, graded by the deterministic division_with_remainder oracle as a
 * "quotient remainder" answer (no model). The G3 exact-division oracle is
 * untouched. Synthetic only.
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
    json(owner, { learnerId: 'kid1', nickname: 'Kid', grade: 4 }),
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

describe('division-with-remainder journey (G4 exp 14)', () => {
  it('coaches SK-NS-div-remainder and grades the quotient-and-remainder', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await seedPaidFamily(app, db);

    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'division-g4', requestedMinutes: 20 }),
    );
    expect(startRes.status).toBe(201);
    const start = await startRes.json();
    const sessionId = start.session.sessionId as string;
    expect(start.next.skillId).toBe('SK-NS-div-remainder');

    const taskId = start.next.defaultTaskId as string; // drem-1: 47 ÷ 5 = 9 r 2
    const reps = ['area-model', 'symbolic', 'area-model'];
    let last:
      | {
          correct: boolean;
          projection: { dimensions: { independent: boolean } };
          sessionComplete?: boolean;
        }
      | undefined;
    for (let i = 0; i < reps.length; i++) {
      const res = await app.request(
        `/learners/kid1/sessions/${sessionId}/answer`,
        json(child, {
          clientSubmissionId: `drem-${i}`,
          taskId,
          answer: '9 2',
          representation: reps[i],
        }),
      );
      expect(res.status).toBe(201);
      last = await res.json();
      expect(last!.correct).toBe(true);
    }
    expect(last!.projection.dimensions.independent).toBe(true);
    expect(last!.sessionComplete).toBe(true);
  });

  it('grades the drops-the-remainder error wrong (no model)', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await seedPaidFamily(app, db);

    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'division-g4', requestedMinutes: 20 }),
    );
    const start = await startRes.json();
    const sessionId = start.session.sessionId as string;

    // drem-1 is 47 ÷ 5 = 9 r 2; answering "9 0" (dropping the remainder) is wrong.
    const res = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer`,
      json(child, {
        clientSubmissionId: 'drops-remainder',
        taskId: start.next.defaultTaskId,
        answer: '9 0',
        representation: 'symbolic',
      }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).correct).toBe(false);
  });
});
