import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';

/**
 * English coaching slice — a SECOND subject proving the engine is not Math-only.
 * The same planner / content-gate / evidence / mastery / stall pipeline drives a
 * regular-plural strand: a fresh learner is remediated to the base plural, then
 * advanced to the sibilant plural.
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

async function startEnglishSession() {
  const db = openDatabase();
  dbs.push(db);
  const app = createApp({ env, db });
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
      json(child, { subject: 'english', requestedMinutes: 20 }),
    )
  ).json();
  return { app, started };
}

const REPS = ['written', 'spoken', 'picture'];

async function coachToIndependent(
  app: Awaited<ReturnType<typeof startEnglishSession>>['app'],
  sessionId: string,
  taskId: string,
  answer: string,
  tag: string,
) {
  let last:
    | {
        correct: boolean;
        projection: { dimensions: { independent: boolean } };
        next: { skillId: string };
      }
    | undefined;
  for (let i = 0; i < REPS.length; i++) {
    const res = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer`,
      json(child, { clientSubmissionId: `${tag}-${i}`, taskId, answer, representation: REPS[i] }),
    );
    expect(res.status).toBe(201);
    last = await res.json();
    expect(last!.correct).toBe(true);
  }
  return last!;
}

describe('English coaching slice', () => {
  it('runs the adaptive remediation → advancement loop for a non-Math subject', async () => {
    const { app, started } = await startEnglishSession();
    const sessionId = started.session.sessionId as string;

    // Session opens on a PLANNER-selected English objective — the base plural
    // (prerequisite of the sibilant plural).
    expect(started.next.skillId).toBe('SK-EN-plural-base');
    expect(started.next.reasonCode).toBe('PREREQUISITE_REMEDIATION');
    expect(started.next.defaultTaskId).toBe('eng-base-1');

    // The content gate validates the English answer key before delivery.
    const taskRes = await app.request(
      `/learners/kid1/sessions/${sessionId}/task?taskId=eng-base-1`,
      json(child, {}),
    );
    expect(taskRes.status).toBe(200);
    const task = await taskRes.json();
    expect(task.skillId).toBe('SK-EN-plural-base');
    expect(task.question).toContain('plural');

    // Coach the base plural to independence (dog → dogs).
    const base = await coachToIndependent(app, sessionId, 'eng-base-1', 'dogs', 'b');
    expect(base.projection.dimensions.independent).toBe(true);
    // With the prerequisite independent, the planner advances to the sibilant plural.
    expect(base.next.skillId).toBe('SK-EN-plural-sibilant');

    // Coach the sibilant plural (box → boxes).
    const sib = await coachToIndependent(app, sessionId, 'eng-sib-1', 'boxes', 's');
    expect(sib.projection.dimensions.independent).toBe(true);

    // Guardian report explains the English choices in plain language.
    const report = await (
      await app.request(`/learners/kid1/sessions/${sessionId}/report`, json(owner))
    ).json();
    expect(report.observed.attempts).toBe(6);
    const worked = report.rationale.bySkill.map((r: { skillId: string }) => r.skillId);
    expect(worked).toContain('SK-EN-plural-base');
    expect(worked).toContain('SK-EN-plural-sibilant');
  });

  it('grades a wrong English answer as incorrect (independent oracle)', async () => {
    const { app, started } = await startEnglishSession();
    const sessionId = started.session.sessionId as string;
    // 'boxs' is not the plural of 'box'.
    const body = await (
      await app.request(
        `/learners/kid1/sessions/${sessionId}/answer`,
        json(child, { clientSubmissionId: 'w1', taskId: 'eng-sib-1', answer: 'boxs' }),
      )
    ).json();
    expect(body.skillId).toBe('SK-EN-plural-sibilant');
    expect(body.correct).toBe(false);
  });

  it('gives an English hint on the first wrong sibilant-plural answer', async () => {
    const { app, started } = await startEnglishSession();
    const sessionId = started.session.sessionId as string;
    const body = await (
      await app.request(
        `/learners/kid1/sessions/${sessionId}/answer`,
        json(child, { clientSubmissionId: 'h1', taskId: 'eng-sib-1', answer: 'boxs' }),
      )
    ).json();
    expect(body.correct).toBe(false);
    expect(body.coaching).toBeUndefined(); // first wrong — hint, not yet a strategy change
    expect(body.hint.misconceptionId).toBe('MC-EN-sibilant-bare-s');
    expect(body.hint.strategyId).toBe('ST-en-say-aloud');
    expect(body.hint.message.length).toBeGreaterThan(0);
  });

  it('stalls to the prerequisite after repeated wrong answers on the sibilant plural', async () => {
    const { app, started } = await startEnglishSession();
    const sessionId = started.session.sessionId as string;
    await app.request(
      `/learners/kid1/sessions/${sessionId}/answer`,
      json(child, { clientSubmissionId: 's1', taskId: 'eng-sib-1', answer: 'boxs' }),
    );
    const second = await (
      await app.request(
        `/learners/kid1/sessions/${sessionId}/answer`,
        json(child, { clientSubmissionId: 's2', taskId: 'eng-sib-1', answer: 'boxs' }),
      )
    ).json();
    expect(second.coaching.stalled).toBe(true);
    expect(second.coaching.strategy).toBe('REMEDIATE_PREREQUISITE');
    expect(second.coaching.suggestedSkillId).toBe('SK-EN-plural-base');
    expect(second.coaching.suggestedTaskId).toBe('eng-base-1');
  });
});
