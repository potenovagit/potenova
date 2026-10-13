import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';

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
    const { session } = await startRes.json();
    expect(session.state).toBe('ACTIVE');
    const sessionId = session.sessionId as string;

    // Deliver a validated task.
    const taskRes = await app.request(
      `/learners/kid1/sessions/${sessionId}/task?taskId=frac-cmp-1`,
      json(child, {}),
    );
    expect(taskRes.status).toBe(200);

    // Three correct answers across THREE representations → INDEPENDENT (DRAFT
    // policy: 3 unaided correct across ≥2 representations).
    const reps = ['symbolic', 'area-model', 'number-line'];
    let lastProjection: unknown;
    for (let i = 0; i < reps.length; i++) {
      const res = await app.request(
        `/learners/kid1/sessions/${sessionId}/answer`,
        json(child, {
          clientSubmissionId: `turn-${i}`,
          taskId: 'frac-cmp-1',
          answer: 'gt', // 1/2 > 1/3
          representation: reps[i],
        }),
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.correct).toBe(true);
      lastProjection = body.projection;
    }

    const proj = lastProjection as {
      evidenceCount: number;
      dimensions: { independent: boolean; representationsCovered: number; unaidedCorrect: number };
    };
    expect(proj.evidenceCount).toBe(3);
    expect(proj.dimensions.unaidedCorrect).toBe(3);
    expect(proj.dimensions.representationsCovered).toBe(3);
    expect(proj.dimensions.independent).toBe(true);

    // Parent dashboard reflects the derived mastery (never hand-set).
    const dashRes = await app.request('/learners/kid1/dashboard?skills=SK-FR-compare', json(owner));
    expect(dashRes.status).toBe(200);
    expect(JSON.stringify(await dashRes.json())).toContain('SK-FR-compare');

    // Session-scoped parent report: observed this session + derived mastery.
    const reportRes = await app.request(`/learners/kid1/sessions/${sessionId}/report`, json(owner));
    expect(reportRes.status).toBe(200);
    const report = await reportRes.json();
    expect(report.observed.attempts).toBe(3);
    expect(report.observed.correct).toBe(3);
    expect(report.observed.bySkill[0].skillId).toBe('SK-FR-compare');
    expect(report.mastery[0].projection.dimensions.independent).toBe(true);
  });
});
