import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import {
  openDatabase,
  EvidenceRepository,
  SessionRepository,
  IdentityRepository,
  BillingRepository,
  type PotenovaDb,
} from '@potenova/persistence';
import type { MasteryEvidence } from '@potenova/learner-state';

/**
 * Family-scope data-subject erasure (PRIV-005): a family erasure cascades across
 * EVERY learner under the family plus the family-level identity rows (family,
 * guardians, consent grants). Billing/financial rows are retained under their
 * retention obligation (reported, never purged here). It still fails closed —
 * complete only once every external target is attested. A second family is left
 * untouched (scope isolation). Synthetic data only; operator-only.
 */

const env = { APP_ENV: 'staging', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };
const operator = { 'x-actor-type': 'operator', 'x-actor-alias': 'op1' };
const guardian = { 'x-actor-type': 'guardian', 'x-actor-alias': 'g1', 'x-family-alias': 'fam1' };

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

function ev(eventId: string, learner: string): MasteryEvidence {
  return {
    eventId,
    learnerAlias: learner,
    skillId: 'SK-FR-equiv',
    mode: 'independent_check',
    assistanceBand: 'A0',
    correct: true,
    representation: 'area-model',
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
  const identity = new IdentityRepository(db);
  const evi = new EvidenceRepository(db);
  const sess = new SessionRepository(db);
  const billing = new BillingRepository(db);

  // Target family fam1: two learners, two guardians, a consent grant, and billing.
  await identity.saveFamily({
    familyId: 'fam1',
    marketRegion: 'ca-on',
    legalOwnerGuardianId: 'g1',
    status: 'ACTIVE',
  });
  await identity.saveGuardian({
    guardianId: 'g1',
    familyId: 'fam1',
    role: 'owner',
    status: 'ACTIVE',
  });
  await identity.saveGuardian({ guardianId: 'g2', familyId: 'fam1', role: 'co', status: 'ACTIVE' });
  for (const kid of ['kid1', 'kid2']) {
    await identity.saveLearner({
      learnerId: kid,
      familyId: 'fam1',
      nickname: kid,
      grade: 5,
      ageBand: 'junior',
      lifecycleStatus: 'ACTIVE',
    });
    await evi.appendEvidence(ev(`${kid}-e1`, kid));
    await evi.appendEvidence(ev(`${kid}-e2`, kid));
    await sess.addUsageMinutes(kid, '2026-10-16', 15);
    await sess.saveGuardianPreference({ learnerAlias: kid, focusSubject: 'math' });
  }
  await identity.saveConsentGrant({
    grantId: 'cg1',
    familyId: 'fam1',
    purpose: 'child_learning',
    version: 'v1',
    modality: 'text',
    state: 'ACTIVE',
    grantedAt: '2026-01-01T00:00:00Z',
    revokedAt: null,
  });
  await billing.saveEntitlement({
    familyId: 'fam1',
    state: 'ACTIVE',
    tierId: 'tier-standard',
    updatedAt: '2026-01-01T00:00:00Z',
  });
  await billing.recordCallback({
    channel: 'stripe',
    transactionId: 'tx1',
    familyId: 'fam1',
    kind: 'payment',
    at: '2026-01-01T00:00:00Z',
  });

  // A second family that must be untouched by the fam1 erasure.
  await identity.saveFamily({
    familyId: 'fam2',
    marketRegion: 'ca-on',
    legalOwnerGuardianId: 'gX',
    status: 'ACTIVE',
  });
  await identity.saveLearner({
    learnerId: 'kidX',
    familyId: 'fam2',
    nickname: 'kidX',
    grade: 3,
    ageBand: 'primary',
    lifecycleStatus: 'ACTIVE',
  });
  await evi.appendEvidence(ev('kidX-e1', 'kidX'));

  return { app, db };
}

describe('family-scope data-subject erasure (PRIV-005)', () => {
  it('cascades across all learners + family identity, retains billing, fails closed', async () => {
    const { app, db } = await setup();

    const started = await app.request(
      '/privacy/erasure',
      json(operator, { subjectType: 'family', subjectId: 'fam1', reason: 'account_closure' }),
    );
    expect(started.status).toBe(201);
    const body = await started.json();

    // Cascade summary.
    expect(body.subjectType).toBe('family');
    expect(body.deleted.scope).toBe('family');
    expect(body.deleted.learnerCount).toBe(2);
    expect(body.deleted.learners.kid1.evidence).toBe(2);
    expect(body.deleted.learners.kid2.evidence).toBe(2);
    expect(body.deleted.learners.kid1.usageDays).toBe(1);
    expect(body.deleted.learners.kid1.preferences).toBe(1);
    expect(body.deleted.familyIdentity).toEqual({ family: 1, guardians: 2, consentGrants: 1 });

    // Billing/financial rows are reported as retained, not purged.
    expect(body.deleted.billingRetained.entitlements).toBe(1);
    expect(body.deleted.billingRetained.providerCallbacks).toBe(1);
    expect(typeof body.deleted.billingRetained.basis).toBe('string');

    // Every learner's data and the family identity rows are actually gone.
    const evi = new EvidenceRepository(db);
    const identity = new IdentityRepository(db);
    expect(await evi.listEvidenceForLearner('kid1')).toEqual([]);
    expect(await evi.listEvidenceForLearner('kid2')).toEqual([]);
    expect(await identity.getLearner('kid1')).toBeNull();
    expect(await identity.getFamily('fam1')).toBeNull();
    expect(await identity.listConsentGrants('fam1')).toEqual([]);

    // Billing really is retained in the store.
    const billing = new BillingRepository(db);
    expect(await billing.getEntitlement('fam1')).not.toBeNull();

    // The other family is untouched (scope isolation).
    expect(await identity.getFamily('fam2')).not.toBeNull();
    expect((await evi.listEvidenceForLearner('kidX')).length).toBe(1);

    // Still fails closed until the external targets are attested.
    const runId = body.requestId as string;
    expect(body.state).toBe('PENDING');
    expect(body.verification.outstanding).toEqual(
      expect.arrayContaining(['analytics', 'provider:azure_openai', 'backups']),
    );
    const attest = (targetId: string, status: string) =>
      app.request(`/privacy/erasure/${runId}/attest`, json(operator, { targetId, status }));
    await attest('analytics', 'completed');
    await attest('provider:azure_openai', 'not_applicable');
    const done = await (await attest('backups', 'tombstoned')).json();
    expect(done.verification.complete).toBe(true);
    expect(done.state).toBe('COMPLETE');
  });

  it('rejects an unknown subject type and is operator-only', async () => {
    const { app } = await setup();

    const badSubject = await app.request(
      '/privacy/erasure',
      json(operator, { subjectType: 'guardian', subjectId: 'g1', reason: 'subject_request' }),
    );
    expect(badSubject.status).toBe(422);

    const forbidden = await app.request(
      '/privacy/erasure',
      json(guardian, { subjectType: 'family', subjectId: 'fam1', reason: 'account_closure' }),
    );
    expect(forbidden.status).toBe(403);
  });
});
