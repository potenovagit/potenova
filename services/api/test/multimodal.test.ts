import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';
import { StubInputProvider } from '@potenova/ai-gateway';

/**
 * Multimodal input (voice / vision): per-modality consent, Canadian-region
 * recognition, and the AT-28 trust floor (low confidence is never graded).
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

async function setup(opts: {
  text: string;
  confidence: number;
  grants?: Array<{ purpose: string; modality: string }>;
}) {
  const db = openDatabase();
  dbs.push(db);
  const app = createApp({
    env,
    db,
    inputProvider: new StubInputProvider({ text: opts.text, confidence: opts.confidence }),
  });
  await app.request(
    '/families',
    json(owner, { familyId: 'fam1', marketRegion: 'ca-on', legalOwnerGuardianId: 'g1' }),
  );
  await app.request(
    '/families/fam1/learners',
    json(owner, { learnerId: 'kid1', nickname: 'Kid', grade: 5 }),
  );
  const grants = opts.grants ?? [
    { purpose: 'child_learning', modality: 'text' },
    { purpose: 'voice_interaction', modality: 'voice' },
    { purpose: 'vision_upload', modality: 'vision' },
  ];
  let i = 0;
  for (const g of grants) {
    await app.request(
      '/families/fam1/consent',
      json(owner, { grantId: `cg${i++}`, purpose: g.purpose, modality: g.modality, version: 'v1' }),
    );
  }
  await new BillingRepository(db).saveEntitlement({
    familyId: 'fam1',
    state: 'PAID_ACTIVE',
    tierId: 't1',
    updatedAt: '2026-10-13T00:00:00Z',
  });
  const started = await (
    await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', requestedMinutes: 15 }),
    )
  ).json();
  return { app, sessionId: started.session.sessionId as string };
}

const mm = (body: unknown) => json(child, body);

describe('multimodal answer', () => {
  it('grades a high-confidence voice answer', async () => {
    const { app, sessionId } = await setup({ text: 'gt', confidence: 0.9 });
    const res = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer/multimodal`,
      mm({ clientSubmissionId: 'v1', taskId: 'frac-cmp-1', modality: 'voice', mediaRef: 'a1' }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.graded).toBe(true);
    expect(body.correct).toBe(true);
    expect(body.recognitionConfidence).toBe(0.9);
  });

  it('asks for clarification on a low-confidence reading (AT-28) — no grade', async () => {
    const { app, sessionId } = await setup({ text: 'gt', confidence: 0.5 });
    const res = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer/multimodal`,
      mm({ clientSubmissionId: 'v1', taskId: 'frac-cmp-1', modality: 'voice', mediaRef: 'a1' }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.graded).toBe(false);
    expect(body.action).toBe('REQUEST_CLARIFICATION');
  });

  it('asks for clarification when the transcript is not an answer', async () => {
    const { app, sessionId } = await setup({ text: 'um maybe?', confidence: 0.95 });
    const body = await (
      await app.request(
        `/learners/kid1/sessions/${sessionId}/answer/multimodal`,
        mm({ clientSubmissionId: 'v1', taskId: 'frac-cmp-1', modality: 'voice', mediaRef: 'a1' }),
      )
    ).json();
    expect(body.action).toBe('REQUEST_CLARIFICATION');
  });

  it('grades a high-confidence vision (OCR) answer', async () => {
    const { app, sessionId } = await setup({ text: 'gt', confidence: 0.9 });
    const body = await (
      await app.request(
        `/learners/kid1/sessions/${sessionId}/answer/multimodal`,
        mm({ clientSubmissionId: 'x1', taskId: 'frac-cmp-1', modality: 'vision', mediaRef: 'i1' }),
      )
    ).json();
    expect(body.graded).toBe(true);
    expect(body.modality).toBe('vision');
  });

  it('demo ref drives the AT-28 floor: a mumbled reading asks for clarification', async () => {
    const { app, sessionId } = await setup({ text: 'gt', confidence: 0.9 });
    const res = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer/multimodal`,
      mm({
        clientSubmissionId: 'd1',
        taskId: 'frac-cmp-1',
        modality: 'voice',
        mediaRef: 'demo:gt:0.4',
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).action).toBe('REQUEST_CLARIFICATION');
  });

  it('demo ref with high confidence grades the answer', async () => {
    const { app, sessionId } = await setup({ text: 'gt', confidence: 0.9 });
    const body = await (
      await app.request(
        `/learners/kid1/sessions/${sessionId}/answer/multimodal`,
        mm({
          clientSubmissionId: 'd2',
          taskId: 'frac-cmp-1',
          modality: 'vision',
          mediaRef: 'demo:gt:0.95',
        }),
      )
    ).json();
    expect(body.graded).toBe(true);
    expect(body.correct).toBe(true);
  });

  it('403s CONSENT_REQUIRED without the voice consent grant', async () => {
    const { app, sessionId } = await setup({
      text: 'gt',
      confidence: 0.9,
      grants: [{ purpose: 'child_learning', modality: 'text' }], // no voice grant
    });
    const res = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer/multimodal`,
      mm({ clientSubmissionId: 'v1', taskId: 'frac-cmp-1', modality: 'voice', mediaRef: 'a1' }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('CONSENT_REQUIRED');
  });
});
