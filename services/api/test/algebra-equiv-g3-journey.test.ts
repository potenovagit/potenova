import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';

/**
 * ×/÷ expression-equivalence journey (Ontario G3 B2.2 / exp 21): decide whether
 * two four-operation expressions are equal in value, graded by the distinct
 * expr_equivalence_muldiv oracle (no model). Synthetic only.
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
    json(owner, { learnerId: 'kid1', nickname: 'Kid', grade: 3 }),
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

describe('×/÷ expression-equivalence journey (G3 B2.2)', () => {
  it('coaches SK-AL-equiv-expr-muldiv and grades the verdict', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await seedPaidFamily(app, db);

    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'algebra-equiv-g3', requestedMinutes: 20 }),
    );
    expect(startRes.status).toBe(201);
    const start = await startRes.json();
    const sessionId = start.session.sessionId as string;
    expect(start.next.skillId).toBe('SK-AL-equiv-expr-muldiv');

    const taskId = start.next.defaultTaskId as string; // equiv-md-1: 4×3 == 24÷2 → yes
    const reps = ['symbolic', 'counters', 'symbolic'];
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
          clientSubmissionId: `equiv-md-${i}`,
          taskId,
          answer: 'yes',
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

  it('grades a wrong verdict wrong — the equals-means-answer error (no model)', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await seedPaidFamily(app, db);

    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'algebra-equiv-g3', requestedMinutes: 20 }),
    );
    const start = await startRes.json();
    const sessionId = start.session.sessionId as string;

    // equiv-md-1 is 4×3 == 24÷2 (both 12) → the true verdict is "yes"; "no" is wrong.
    const res = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer`,
      json(child, {
        clientSubmissionId: 'wrong-verdict',
        taskId: start.next.defaultTaskId,
        answer: 'no',
        representation: 'symbolic',
      }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).correct).toBe(false);
  });
});
