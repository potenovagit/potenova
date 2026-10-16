import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import {
  openDatabase,
  EvidenceRepository,
  SessionRepository,
  type PotenovaDb,
} from '@potenova/persistence';
import type { MasteryEvidence } from '@potenova/learner-state';

/**
 * Data-subject erasure (PRIV-005): a right-to-erasure deletes the learner's
 * first-party rows immediately, and the request is "complete" only once EVERY
 * required target (analytics, AI provider, backups) is attested — fail-closed.
 * Synthetic data only; operator-only.
 */

const env = { APP_ENV: 'staging', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };
const owner = {
  'x-actor-type': 'guardian',
  'x-actor-alias': 'g1',
  'x-guardian-role': 'owner',
  'x-family-alias': 'fam1',
};
const operator = { 'x-actor-type': 'operator', 'x-actor-alias': 'op1' };

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

function ev(eventId: string, rep: string): MasteryEvidence {
  return {
    eventId,
    learnerAlias: 'kid1',
    skillId: 'SK-FR-equiv',
    mode: 'independent_check',
    assistanceBand: 'A0',
    correct: true,
    representation: rep,
    recognitionConfidence: 1,
    observedAt: '2026-10-10T00:00:00Z',
    curriculumReleaseId: 'REL-ONT-MATH-2020-draft',
    schemaVersion: 'evt-0.1',
  };
}

async function setup() {
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
  // Seed first-party data across several tables.
  const evi = new EvidenceRepository(db);
  await evi.appendEvidence(ev('e1', 'area-model'));
  await evi.appendEvidence(ev('e2', 'number-line'));
  await evi.appendEvidence(ev('e3', 'symbolic'));
  const sess = new SessionRepository(db);
  await sess.addUsageMinutes('kid1', '2026-10-16', 15);
  await sess.saveGuardianPreference({
    learnerAlias: 'kid1',
    focusSubject: 'math',
    focusStrand: 'addition',
  });
  return { app, db };
}

describe('data-subject erasure (PRIV-005)', () => {
  it('deletes first-party rows and fails closed until every target is attested', async () => {
    const { app, db } = await setup();

    const started = await app.request(
      '/privacy/erasure',
      json(operator, { subjectType: 'learner', subjectId: 'kid1', reason: 'subject_request' }),
    );
    expect(started.status).toBe(201);
    const body = await started.json();

    // The learner's first-party rows are actually gone.
    expect(body.deleted.evidence).toBe(3);
    expect(body.deleted.profile).toBe(1);
    expect(body.deleted.usageDays).toBe(1);
    expect(body.deleted.preferences).toBe(1);
    const evi = new EvidenceRepository(db);
    expect(await evi.listEvidenceForLearner('kid1')).toEqual([]);

    // But the erasure is NOT complete — external targets are still outstanding.
    const runId = body.requestId as string;
    expect(body.state).toBe('PENDING');
    expect(body.verification.complete).toBe(false);
    expect(body.verification.outstanding).toEqual(
      expect.arrayContaining(['analytics', 'provider:azure_openai', 'backups']),
    );

    // Attest the external targets one by one.
    const attest = (targetId: string, status: string) =>
      app.request(`/privacy/erasure/${runId}/attest`, json(operator, { targetId, status }));

    let r = await (await attest('analytics', 'completed')).json();
    expect(r.state).toBe('PENDING');
    r = await (await attest('provider:azure_openai', 'not_applicable')).json();
    expect(r.state).toBe('PENDING');
    r = await (await attest('backups', 'tombstoned')).json();
    // Every required target accounted for → complete.
    expect(r.verification.complete).toBe(true);
    expect(r.state).toBe('COMPLETE');

    const status = await (await app.request(`/privacy/erasure/${runId}`, json(operator))).json();
    expect(status.state).toBe('COMPLETE');
  });

  it('enforces role, reason, target and status validation', async () => {
    const { app } = await setup();

    // Non-operator cannot run an erasure.
    const forbidden = await app.request(
      '/privacy/erasure',
      json(owner, { subjectType: 'learner', subjectId: 'kid1', reason: 'subject_request' }),
    );
    expect(forbidden.status).toBe(403);

    // Invalid reason.
    const badReason = await app.request(
      '/privacy/erasure',
      json(operator, { subjectType: 'learner', subjectId: 'kid1', reason: 'because' }),
    );
    expect(badReason.status).toBe(422);

    const started = await (
      await app.request(
        '/privacy/erasure',
        json(operator, { subjectType: 'learner', subjectId: 'kid1', reason: 'account_closure' }),
      )
    ).json();

    // A target not in the plan is rejected.
    const badTarget = await app.request(
      `/privacy/erasure/${started.requestId}/attest`,
      json(operator, { targetId: 'nope', status: 'completed' }),
    );
    expect(badTarget.status).toBe(404);

    // An invalid deletion status is rejected.
    const badStatus = await app.request(
      `/privacy/erasure/${started.requestId}/attest`,
      json(operator, { targetId: 'analytics', status: 'maybe' }),
    );
    expect(badStatus.status).toBe(422);
  });
});
