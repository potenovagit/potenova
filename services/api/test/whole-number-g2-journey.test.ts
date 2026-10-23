import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';

/**
 * Grade 2 compare/order-to-200 journey (Ontario G2 B1.2) — the first Grade 2
 * course. It reuses the G1 integer comparison/ordering oracles unchanged at the
 * higher bound, proving the per-grade loop extends the engine rather than adding
 * capability. Synthetic only.
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
    json(owner, { learnerId: 'kid1', nickname: 'Kid', grade: 2 }),
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

describe('Grade 2 compare/order-to-200 journey (G2 B1.2)', () => {
  it('coaches compare → order to 200 and grades relation + ordering answers', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await seedPaidFamily(app, db);

    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'whole-number-g2', requestedMinutes: 20 }),
    );
    expect(startRes.status).toBe(201);
    const start = await startRes.json();
    const sessionId = start.session.sessionId as string;
    expect(start.next.skillId).toBe('SK-NS-compare-whole-200');

    const reps = ['counters', 'number-line', 'symbolic'];
    // cmpw2-1 = (98,120) → lt ; ordw2-1 = [150,95,200] → 2,1,3
    const answerFor: Record<string, string> = {
      'SK-NS-compare-whole-200': 'lt',
      'SK-NS-order-whole-200': '2,1,3',
    };
    const coached: string[] = [];
    let rec = start.next as { skillId: string; defaultTaskId: string } | null;
    let completed = false;

    while (rec && !coached.includes('SK-NS-order-whole-200')) {
      const { skillId, defaultTaskId: taskId } = rec;
      let last:
        | {
            correct: boolean;
            projection: { dimensions: { independent: boolean } };
            next: typeof rec;
            sessionComplete?: boolean;
          }
        | undefined;
      for (let i = 0; i < reps.length; i++) {
        const res = await app.request(
          `/learners/kid1/sessions/${sessionId}/answer`,
          json(child, {
            clientSubmissionId: `${skillId}-${i}`,
            taskId,
            answer: answerFor[skillId],
            representation: reps[i],
          }),
        );
        expect(res.status).toBe(201);
        last = await res.json();
        expect(last!.correct).toBe(true);
      }
      expect(last!.projection.dimensions.independent).toBe(true);
      coached.push(skillId);
      completed = !!last!.sessionComplete;
      rec = last!.next;
    }

    expect(coached).toEqual(['SK-NS-compare-whole-200', 'SK-NS-order-whole-200']);
    expect(completed).toBe(true);
  });

  it('grades the 2-digit-looks-bigger trap wrong (no model)', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await seedPaidFamily(app, db);

    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'whole-number-g2', requestedMinutes: 20 }),
    );
    const start = await startRes.json();
    const sessionId = start.session.sessionId as string;

    // cmpw2-1 is 98 vs 120 → lt; answering gt (98 "looks bigger") is wrong.
    const res = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer`,
      json(child, {
        clientSubmissionId: 'wrong-cmp2',
        taskId: start.next.defaultTaskId,
        answer: 'gt',
        representation: 'symbolic',
      }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).correct).toBe(false);
  });
});
