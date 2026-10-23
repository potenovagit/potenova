import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';

/**
 * Subtraction-strand journey: a Math session pinned to the SUBTRACTION course
 * (number sense, Ontario G1 B2.2/B2.3) runs the identical adaptive loop as
 * fractions and addition, proving the engine is strand-agnostic. The planner
 * walks within10 → within20 and integer answers are graded by the deterministic
 * subtraction oracle (no model on this path). Synthetic data only.
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

describe('subtraction-strand journey (fourth coachable strand)', () => {
  it('coaches SK-NS-sub-within10 → within20 and grades integer answers', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });

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

    // Start a MATH session pinned to the subtraction strand.
    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'subtraction', requestedMinutes: 20 }),
    );
    expect(startRes.status).toBe(201);
    const start = await startRes.json();
    expect(start.session.state).toBe('ACTIVE');
    const sessionId = start.session.sessionId as string;

    // A fresh learner enters at the foundational within-10 subtraction skill.
    expect(start.next.skillId).toBe('SK-NS-sub-within10');

    const reps = ['counters', 'number-line', 'symbolic'];
    const answerFor: Record<string, string> = {
      'SK-NS-sub-within10': '4', // sub-10-1 = 7 - 3
      'SK-NS-sub-within20': '8', // sub-20-1 = 13 - 5
    };
    const coached: string[] = [];
    let rec = start.next as { skillId: string; defaultTaskId: string } | null;
    let completed = false;

    while (rec && !coached.includes('SK-NS-sub-within20')) {
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

    // The planner advanced within10 → within20 (prerequisite-first).
    expect(coached).toEqual(['SK-NS-sub-within10', 'SK-NS-sub-within20']);
    expect(completed).toBe(true);

    // Dashboard groups the subtraction skills under Math (derived, never hand-set).
    const dashRes = await app.request('/learners/kid1/dashboard', json(owner));
    expect(dashRes.status).toBe(200);
    const dash = await dashRes.json();
    const math = dash.bySubject.find((g: { subject: string }) => g.subject === 'math');
    expect(math).toBeTruthy();
    expect(JSON.stringify(math)).toContain('SK-NS-sub-within10');
  });

  it('a WRONG answer is graded wrong by the oracle (no model)', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
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

    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'subtraction', requestedMinutes: 20 }),
    );
    const start = await startRes.json();
    const sessionId = start.session.sessionId as string;
    const taskId = start.next.defaultTaskId as string; // sub-10-1 = 7 - 3 → 4

    const res = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer`,
      json(child, {
        clientSubmissionId: 'wrong-1',
        taskId,
        answer: '2', // smaller-from-larger error (3 - 1 style) — a valid but wrong token
        representation: 'counters',
      }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).correct).toBe(false);
  });

  it('rejects a task from another course in an active subtraction session', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });

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

    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'subtraction', requestedMinutes: 20 }),
    );
    const { session } = await startRes.json();

    // An addition task (same subject, different course) must not be delivered.
    const res = await app.request(
      `/learners/kid1/sessions/${session.sessionId}/task?taskId=add-10-1`,
      json(child, {}),
    );
    expect(res.status).toBe(422);
    expect(JSON.stringify(await res.json())).toContain('not for this session course');
  });
});
