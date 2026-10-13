import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';

/**
 * Adaptive planner + remediation (API level). The planner — not a fixed task
 * order — picks the next skill from derived mastery over the canonical graph:
 * a fresh learner is remediated to the prerequisite (SK-FR-equiv), and once that
 * is independent the planner advances to the dependent skill (SK-FR-compare).
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

async function startSession() {
  const db = openDatabase();
  dbs.push(db);
  const app = createApp({ env, db });
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
    json(owner, { grantId: 'cg0', purpose: 'child_learning', modality: 'text', version: 'v1' }),
  );
  await new BillingRepository(db).saveEntitlement({
    familyId: 'fam1',
    state: 'PAID_ACTIVE',
    tierId: 't1',
    updatedAt: '2026-10-13T00:00:00Z',
  });
  const started = await (
    await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', requestedMinutes: 20 }),
    )
  ).json();
  return { app, sessionId: started.session.sessionId as string };
}

const REPS = ['symbolic', 'area-model', 'number-line'];

/** Coach a task to independence: 3 correct answers across 3 representations. */
async function coachToIndependent(
  app: Awaited<ReturnType<typeof startSession>>['app'],
  sessionId: string,
  taskId: string,
  answer: string,
  tag: string,
) {
  let last: { correct: boolean; projection: { dimensions: { independent: boolean } } } | undefined;
  for (let i = 0; i < REPS.length; i++) {
    const res = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer`,
      json(child, {
        clientSubmissionId: `${tag}-${i}`,
        taskId,
        answer,
        representation: REPS[i],
      }),
    );
    expect(res.status).toBe(201);
    last = await res.json();
    expect(last!.correct).toBe(true);
  }
  return last!;
}

const next = async (app: Awaited<ReturnType<typeof startSession>>['app'], sessionId: string) =>
  (await app.request(`/learners/kid1/sessions/${sessionId}/next`, json(child))).json();

describe('adaptive planner + remediation', () => {
  it('remediates to the prerequisite, then advances once it is mastered', async () => {
    const { app, sessionId } = await startSession();

    // 1. Fresh learner → the planner remediates to the prerequisite (equivalence).
    const first = await next(app, sessionId);
    expect(first.skillId).toBe('SK-FR-equiv');
    expect(first.blockedSkillId).toBe('SK-FR-compare');
    expect(first.reasonCode).toBe('PREREQUISITE_REMEDIATION');
    expect(first.defaultTaskId).toBe('frac-eq-1');

    // The delivered equivalence task is skill-correct and validated.
    const taskRes = await app.request(
      `/learners/kid1/sessions/${sessionId}/task?taskId=frac-eq-1`,
      json(child, {}),
    );
    expect(taskRes.status).toBe(200);
    const task = await taskRes.json();
    expect(task.skillId).toBe('SK-FR-equiv');
    expect(task.options).toEqual(['yes', 'no']);

    // 2. Coach equivalence to independence (1/2 ?= 2/4 → yes).
    const eqResult = await coachToIndependent(app, sessionId, 'frac-eq-1', 'yes', 'eq');
    expect(eqResult.skillId).toBe('SK-FR-equiv');
    expect(eqResult.projection.dimensions.independent).toBe(true);

    // 3. With the prerequisite independent, the planner advances to comparison.
    const second = await next(app, sessionId);
    expect(second.skillId).toBe('SK-FR-compare');
    expect(second.blockedSkillId).toBeNull();
    expect(second.reasonCode).not.toBe('PREREQUISITE_REMEDIATION');
    expect(second.defaultTaskId).toBe('frac-cmp-1');

    // 4. Coach comparison to independence (1/2 > 1/3 → gt).
    const cmpResult = await coachToIndependent(app, sessionId, 'frac-cmp-1', 'gt', 'cmp');
    expect(cmpResult.skillId).toBe('SK-FR-compare');
    expect(cmpResult.projection.dimensions.independent).toBe(true);
  });

  it('grades an equivalence answer with the independent oracle (wrong answer = incorrect)', async () => {
    const { app, sessionId } = await startSession();
    // frac-eq-2 is 1/2 vs 1/3 → NOT equivalent; answering 'yes' must be graded wrong.
    const res = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer`,
      json(child, { clientSubmissionId: 's1', taskId: 'frac-eq-2', answer: 'yes' }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.skillId).toBe('SK-FR-equiv');
    expect(body.correct).toBe(false);
  });

  it('rejects an answer token that is invalid for the task kind', async () => {
    const { app, sessionId } = await startSession();
    // 'gt' is a comparison token — invalid for an equivalence task.
    const res = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer`,
      json(child, { clientSubmissionId: 's1', taskId: 'frac-eq-1', answer: 'gt' }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe('POLICY_BLOCKED');
  });
});
