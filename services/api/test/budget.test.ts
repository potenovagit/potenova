import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';

/**
 * Session item budget (ER-09, learner-protection). The DRAFT ceiling is 8 graded
 * items; reaching it ends the session cleanly (COMPLETED) and further coaching is
 * refused. A task from another subject is rejected (clean subject scoping).
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

async function startMathSession() {
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
  return { app, started, sessionId: started.session.sessionId as string };
}

const answer = (
  app: Awaited<ReturnType<typeof startMathSession>>['app'],
  sessionId: string,
  id: string,
) =>
  app.request(
    `/learners/kid1/sessions/${sessionId}/answer`,
    json(child, { clientSubmissionId: id, taskId: 'frac-cmp-1', answer: 'gt' }),
  );

describe('session item budget (ER-09)', () => {
  it('surfaces the budget on session start', async () => {
    const { started } = await startMathSession();
    expect(started.budget.maxItems).toBe(8);
    expect(started.budget.itemsRemaining).toBe(8);
    expect(started.budget.policyVersion).toContain('DRAFT');
  });

  it('completes the session at the item ceiling and refuses further coaching', async () => {
    const { app, sessionId } = await startMathSession();

    for (let i = 1; i <= 7; i++) {
      const body = await (await answer(app, sessionId, `t${i}`)).json();
      expect(body.graded).toBe(true);
      expect(body.budget.itemsDelivered).toBe(i);
      expect(body.sessionComplete).toBeUndefined();
    }

    // The 8th graded item reaches the ceiling → session ends cleanly, with the
    // session-scoped summary returned inline as a wrap-up.
    const eighth = await (await answer(app, sessionId, 't8')).json();
    expect(eighth.sessionComplete).toBe(true);
    expect(eighth.budget.itemsDelivered).toBe(8);
    expect(eighth.budget.itemCeilingReached).toBe(true);
    expect(eighth.summary.state).toBe('COMPLETED');
    expect(eighth.summary.observed.attempts).toBe(8);
    expect(eighth.summary.observed.bySkill[0].skillId).toBe('SK-FR-compare');
    expect(eighth.summary.rationale.nextObjective.explanation.length).toBeGreaterThan(0);

    // The session is COMPLETED — a 9th answer is refused.
    const ninth = await answer(app, sessionId, 't9');
    expect(ninth.status).toBe(422);
    expect((await ninth.json()).code).toBe('POLICY_BLOCKED');
  });

  it('rejects a task from another subject (subject scoping)', async () => {
    const { app, sessionId } = await startMathSession();
    const taskRes = await app.request(
      `/learners/kid1/sessions/${sessionId}/task?taskId=eng-base-1`,
      json(child, {}),
    );
    expect(taskRes.status).toBe(422);
    const ans = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer`,
      json(child, { clientSubmissionId: 'x1', taskId: 'eng-base-1', answer: 'dogs' }),
    );
    expect(ans.status).toBe(422);
  });
});
