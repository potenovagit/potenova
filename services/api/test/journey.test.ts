import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';
import { seedMastered } from './support/seed';

/**
 * Capstone: the G1 vertical slice end to end on synthetic data.
 * onboard → learner → consent → entitlement → session (guard stack) → coaching
 * turns (validated delivery → graded answers → immutable evidence) → derived
 * mastery reaches INDEPENDENT → parent dashboard reflects it.
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

describe('G1 journey (capstone)', () => {
  it('walks onboarding → session → coaching → mastery → parent dashboard', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });

    // Onboarding: family, learner (grade 5 → junior), consent, entitlement.
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
      updatedAt: '2026-10-13T00:00:00Z',
    });

    // Precondition: the lower pilot fraction skills are already mastered, so this
    // capstone exercises the equiv→compare remediation + advancement in isolation.
    // (The full seven-skill walk from a blank slate lives in diagnostic-run.test.ts.)
    for (const skillId of [
      'SK-FR-partition',
      'SK-FR-unit',
      'SK-FR-nonunit',
      'SK-FR-numberline',
      'SK-FR-order',
    ]) {
      await seedMastered(db, skillId, '2026-10-13T00:00:00Z', `pre-${skillId}`);
    }

    // Diagnostic selects what to probe first — it picks the foundational,
    // low-confidence fractions skill we then coach.
    const probeRes = await app.request(
      '/diagnostic/next-probe',
      json(child, {
        learnerGrade: 5,
        candidates: [
          {
            skillId: 'SK-FR-compare',
            grade: 5,
            priorConfidence: 0.1,
            priorState: 'UNASSESSED',
            representationsCovered: 0,
            foundationalFanout: 4,
            valid: true,
          },
          {
            skillId: 'counting',
            grade: 1,
            priorConfidence: 0.95,
            priorState: 'RETAINED',
            representationsCovered: 3,
            foundationalFanout: 1,
            valid: true,
          },
        ],
      }),
    );
    const { probe } = await probeRes.json();
    expect(probe.skillId).toBe('SK-FR-compare');

    // Start a session — the full guard stack must pass.
    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', requestedMinutes: 20 }),
    );
    expect(startRes.status).toBe(201);
    const start = await startRes.json();
    expect(start.session.state).toBe('ACTIVE');
    const sessionId = start.session.sessionId as string;

    // The FIRST objective is planner-selected end-to-end — not a hardcoded task.
    // A fresh learner is remediated to the prerequisite (equivalence) before the
    // diagnostic's target skill (comparison).
    expect(start.next.skillId).toBe('SK-FR-equiv');
    expect(start.next.reasonCode).toBe('PREREQUISITE_REMEDIATION');

    // Drive the WHOLE session off the planner's recommendation — each graded
    // answer returns the next objective, no fixed task ids anywhere.
    const reps = ['symbolic', 'area-model', 'number-line'];
    const answerFor: Record<string, string> = { 'SK-FR-equiv': 'yes', 'SK-FR-compare': 'gt' };
    const coached: string[] = [];
    let rec = start.next as { skillId: string; defaultTaskId: string } | null;

    while (rec && !coached.includes('SK-FR-compare')) {
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
      rec = last!.next;
    }
    // The planner walked the learner prerequisite-first, then advanced.
    expect(coached).toEqual(['SK-FR-equiv', 'SK-FR-compare']);

    // Parent dashboard reflects the derived mastery (never hand-set).
    const dashRes = await app.request('/learners/kid1/dashboard?skills=SK-FR-compare', json(owner));
    expect(dashRes.status).toBe(200);
    expect(JSON.stringify(await dashRes.json())).toContain('SK-FR-compare');

    // Session-scoped parent report: observed this session + derived mastery.
    const reportRes = await app.request(`/learners/kid1/sessions/${sessionId}/report`, json(owner));
    expect(reportRes.status).toBe(200);
    const report = await reportRes.json();
    expect(report.observed.attempts).toBe(6); // 3 equivalence + 3 comparison
    expect(report.observed.correct).toBe(6);
    const compare = report.mastery.find((m: { skillId: string }) => m.skillId === 'SK-FR-compare');
    expect(compare.projection.dimensions.independent).toBe(true);
  });
});
