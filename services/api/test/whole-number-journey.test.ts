import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';

/**
 * Whole-number compare/order journey (Ontario G1 B1.3): a Math session pinned to
 * the WHOLE-NUMBER course runs the identical adaptive loop as every other strand.
 * The planner walks compare → order; a relation answer and an ordering answer are
 * graded by the deterministic whole-number oracle (no model). Synthetic only.
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
    json(owner, { learnerId: 'kid1', nickname: 'Kid', grade: 1 }),
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

describe('whole-number compare/order journey (G1 B1.3)', () => {
  it('coaches SK-NS-compare-whole-50 → order-whole-50 and grades relation + ordering answers', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await seedPaidFamily(app, db);

    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'whole-number', requestedMinutes: 20 }),
    );
    expect(startRes.status).toBe(201);
    const start = await startRes.json();
    const sessionId = start.session.sessionId as string;

    // A fresh learner enters at comparison (the prerequisite), not ordering.
    expect(start.next.skillId).toBe('SK-NS-compare-whole-50');

    const reps = ['counters', 'number-line', 'symbolic'];
    // cmpw-1 = (12,21) → lt ; ordw-1 = [23,8,41] → positions 2,1,3
    const answerFor: Record<string, string> = {
      'SK-NS-compare-whole-50': 'lt',
      'SK-NS-order-whole-50': '2,1,3',
    };
    const coached: string[] = [];
    let rec = start.next as { skillId: string; defaultTaskId: string } | null;
    let completed = false;

    while (rec && !coached.includes('SK-NS-order-whole-50')) {
      const { skillId, defaultTaskId: taskId } = rec;

      const taskRes = await app.request(
        `/learners/kid1/sessions/${sessionId}/task?taskId=${taskId}`,
        json(child, {}),
      );
      expect(taskRes.status).toBe(200);
      expect((await taskRes.json()).skillId).toBe(skillId);

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

    expect(coached).toEqual(['SK-NS-compare-whole-50', 'SK-NS-order-whole-50']);
    expect(completed).toBe(true);

    const dashRes = await app.request('/learners/kid1/dashboard', json(owner));
    const dash = await dashRes.json();
    const math = dash.bySubject.find((g: { subject: string }) => g.subject === 'math');
    expect(JSON.stringify(math)).toContain('SK-NS-compare-whole-50');
  });

  it('grades a wrong ordering wrong (no model)', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await seedPaidFamily(app, db);

    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'whole-number', requestedMinutes: 20 }),
    );
    const start = await startRes.json();
    const sessionId = start.session.sessionId as string;

    // Answer the compare task with a wrong relation (the ones-digit trap on 12 vs 21).
    const res = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer`,
      json(child, {
        clientSubmissionId: 'wrong-cmp',
        taskId: start.next.defaultTaskId,
        answer: 'gt',
        representation: 'symbolic',
      }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).correct).toBe(false);
  });
});
