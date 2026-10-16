import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, type PotenovaDb } from '@potenova/persistence';

/**
 * Adaptive diagnostic run: the SERVER picks each probe by information gain +
 * foundational weight over accumulated evidence, and stops on confidence
 * (SUFFICIENT) or the attention-budget ceiling (PARTIAL) — never a fixed count.
 * Each probe is gate-validated, oracle-graded, and recorded as immutable
 * `diagnostic` evidence; placement is re-derived. Synthetic only.
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

// The fixed synthetic fractions bank, by task id.
const CORRECT: Record<string, string> = {
  'frac-eq-1': 'yes',
  'frac-eq-2': 'no',
  'frac-eq-3': 'yes',
  'frac-eq-4': 'no',
  'frac-cmp-1': 'gt',
  'frac-cmp-2': 'eq',
  'frac-cmp-3': 'lt',
  'frac-cmp-4': 'lt',
};
const WRONG: Record<string, string> = {
  'frac-eq-1': 'no',
  'frac-eq-2': 'yes',
  'frac-eq-3': 'no',
  'frac-eq-4': 'yes',
  'frac-cmp-1': 'lt',
  'frac-cmp-2': 'lt',
  'frac-cmp-3': 'gt',
  'frac-cmp-4': 'gt',
};

async function onboard() {
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
    json(owner, { grantId: 'cg1', purpose: 'child_learning', modality: 'text', version: 'v1' }),
  );
  return app;
}

describe('adaptive diagnostic run', () => {
  it('probes foundational-first, adapts, and stops SUFFICIENT when confident', async () => {
    const app = await onboard();

    const start = await (
      await app.request('/learners/kid1/diagnostic/runs', json(child, { subject: 'math' }))
    ).json();
    expect(start.state).toBe('ACTIVE');
    // Equivalence is the prerequisite of comparison → highest foundational weight.
    expect(start.next.skillId).toBe('SK-FR-equiv');
    const runId = start.runId as string;

    const probed: string[] = [];
    let resp = start;
    for (let i = 0; i < 20 && !resp.complete; i++) {
      const next = resp.next as { skillId: string; taskId: string };
      probed.push(next.skillId);
      resp = await (
        await app.request(
          `/learners/kid1/diagnostic/runs/${runId}/answer`,
          json(child, {
            clientSubmissionId: `p${i}`,
            taskId: next.taskId,
            answer: CORRECT[next.taskId],
          }),
        )
      ).json();
      expect(resp.correct).toBe(true);
    }

    // Confidence-based stop (no fixed count), within the attention budget.
    expect(resp.complete).toBe(true);
    expect(resp.stop.kind).toBe('SUFFICIENT');
    expect(resp.probesUsed).toBeLessThanOrEqual(12);
    // The run adapted to both target skills, not just the first.
    expect(new Set(probed).size).toBeGreaterThanOrEqual(2);
    expect(new Set(probed)).toContain('SK-FR-compare');

    // Placement is derived from the diagnostic evidence (high confidence).
    const eq = resp.placement.profile.skills.find(
      (s: { skillId: string }) => s.skillId === 'SK-FR-equiv',
    );
    const cmp = resp.placement.profile.skills.find(
      (s: { skillId: string }) => s.skillId === 'SK-FR-compare',
    );
    expect(eq.confidence).toBeGreaterThanOrEqual(0.8);
    expect(cmp.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('stops PARTIAL at the attention-budget ceiling when nothing resolves', async () => {
    const app = await onboard();
    const start = await (
      await app.request('/learners/kid1/diagnostic/runs', json(child, { subject: 'math' }))
    ).json();
    const runId = start.runId as string;

    let resp = start;
    for (let i = 0; i < 15 && !resp.complete; i++) {
      const next = resp.next as { taskId: string };
      resp = await (
        await app.request(
          `/learners/kid1/diagnostic/runs/${runId}/answer`,
          json(child, {
            clientSubmissionId: `w${i}`,
            taskId: next.taskId,
            answer: WRONG[next.taskId],
          }),
        )
      ).json();
      expect(resp.correct).toBe(false);
    }

    expect(resp.complete).toBe(true);
    expect(resp.stop.kind).toBe('PARTIAL');
    expect(resp.stop.reason).toBe('ATTENTION_BUDGET');
    expect(resp.probesUsed).toBe(12); // the DRAFT attentionBudget
    // Unresolved skills are returned explicitly as unknowns — never a failure label.
    expect(resp.stop.unresolvedSkillIds).toContain('SK-FR-equiv');
  });

  it('resumes an active run to the current probe (read-only)', async () => {
    const app = await onboard();
    const start = await (
      await app.request('/learners/kid1/diagnostic/runs', json(child, { subject: 'math' }))
    ).json();
    const runId = start.runId as string;

    // Reconnecting returns the current probe without advancing the run.
    const r1 = await (
      await app.request(`/learners/kid1/diagnostic/runs/${runId}`, json(child))
    ).json();
    expect(r1.state).toBe('ACTIVE');
    expect(r1.probesUsed).toBe(0);
    expect(r1.next.skillId).toBe('SK-FR-equiv');
    // A second resume is identical — no evidence recorded, no advance.
    const r2 = await (
      await app.request(`/learners/kid1/diagnostic/runs/${runId}`, json(child))
    ).json();
    expect(r2.probesUsed).toBe(0);
    expect(r2.next.taskId).toBe(r1.next.taskId);

    // After an answer, resume reflects the advanced state.
    await app.request(
      `/learners/kid1/diagnostic/runs/${runId}/answer`,
      json(child, {
        clientSubmissionId: 'a0',
        taskId: r1.next.taskId,
        answer: CORRECT[r1.next.taskId],
      }),
    );
    const r3 = await (
      await app.request(`/learners/kid1/diagnostic/runs/${runId}`, json(child))
    ).json();
    expect(r3.probesUsed).toBe(1);
  });

  it('is consent-fenced and course-guarded', async () => {
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
    // No consent yet → fail closed.
    const noConsent = await app.request(
      '/learners/kid1/diagnostic/runs',
      json(child, { subject: 'math' }),
    );
    expect(noConsent.status).toBe(403);

    await app.request(
      '/families/fam1/consent',
      json(owner, { grantId: 'cg1', purpose: 'child_learning', modality: 'text', version: 'v1' }),
    );
    const start = await (
      await app.request('/learners/kid1/diagnostic/runs', json(child, { subject: 'math' }))
    ).json();
    // A task from another course (English) is refused for a math run.
    const wrongCourse = await app.request(
      `/learners/kid1/diagnostic/runs/${start.runId}/answer`,
      json(child, { clientSubmissionId: 'x0', taskId: 'eng-base-1', answer: 'dogs' }),
    );
    expect(wrongCourse.status).toBe(422);
  });
});
