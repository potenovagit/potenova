import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import {
  openDatabase,
  BillingRepository,
  EvidenceRepository,
  type PotenovaDb,
} from '@potenova/persistence';
import type { MasteryEvidence } from '@potenova/learner-state';
import {
  generatedTransferTaskId,
  generatedTaskId,
  isTransferTask,
  resolveTask,
  gateTask,
  present,
  judge,
  tokenValid,
  correctAnswerFor,
  TRANSFER_TASKS,
} from '../src/task-bank';

/**
 * Loop completeness (ADR-0028/0029 follow-up): a GENERATED skill can now reach
 * TRANSFERABLE. A generated transfer id carries a `transfer` marker — resolved as
 * a novel-context `stretch` item and graded as a transfer_check (AT-12) — so a
 * correct answer lifts an already-mastered generated-only skill to the top
 * standing, exactly like the static `frac-xfer-*` / `eng-xfer-*` items.
 * Generator ≠ validator (TM-10); a wrong key still BLOCKs (AT-20); synthetic, pre-G2.
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

describe('generated transfer path (task layer)', () => {
  const seed = 7;

  it('marks a generated transfer id as a transfer turn — static ids too', () => {
    for (const skillId of [
      'SK-FR-partition',
      'SK-FR-unit',
      'SK-FR-nonunit',
      'SK-FR-numberline',
      'SK-FR-order',
      'SK-EN-past-regular',
      'SK-EN-comparative',
    ]) {
      expect(isTransferTask(generatedTransferTaskId(skillId, 0, seed))).toBe(true);
      // a plain practice item on the same skill is NOT a transfer turn
      expect(isTransferTask(generatedTaskId(skillId, 0, seed, 'core'))).toBe(false);
    }
    for (const staticId of TRANSFER_TASKS) expect(isTransferTask(staticId)).toBe(true);
    expect(isTransferTask('frac-cmp-1')).toBe(false);
  });

  it('resolves, gates and grades a generated transfer item — a novel (stretch) context', () => {
    for (const skillId of [
      'SK-FR-partition',
      'SK-FR-unit',
      'SK-FR-nonunit',
      'SK-FR-numberline',
      'SK-FR-order',
      'SK-EN-past-regular',
      'SK-EN-comparative',
    ]) {
      const xferId = generatedTransferTaskId(skillId, 0, seed);
      const task = gateTask(xferId); // content gate passes for the transfer item
      expect(task.skillId).toBe(skillId);
      expect(present(task).question.length).toBeGreaterThan(0);

      const correct = correctAnswerFor(task);
      expect(tokenValid(task, correct)).toBe(true);
      expect(judge(task, correct)).toBe(true);

      // The transfer item is the hardest (stretch) tier — a genuinely different item
      // from the core practice stream, so it is a novel context (AT-12), not a repeat.
      const stretch = resolveTask(generatedTaskId(skillId, 0, seed, 'stretch'));
      expect(resolveTask(xferId)).toEqual(stretch);
    }
  });
});

describe('generated transfer path (end to end)', () => {
  // A single-skill English course: once the skill is independent the only next move
  // is its transfer check — the cleanest way to drive a generated skill to TRANSFERABLE.
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
      json(owner, { learnerId: 'kid1', nickname: 'Kid', grade: 3 }),
    );
    await app.request(
      '/families/fam1/consent',
      json(owner, { grantId: 'cg1', purpose: 'child_learning', modality: 'text', version: 'v1' }),
    );
    await new BillingRepository(db).saveEntitlement({
      familyId: 'fam1',
      state: 'PAID_ACTIVE',
      tierId: 't1',
      updatedAt: '2026-10-18T00:00:00Z',
    });
    return app;
  }

  const reps = ['written', 'spoken', 'picture'];

  // Seed a skill INDEPENDENT (3 unaided-correct across 3 representations) so the
  // planner's next move is the transfer check — mirrors the static transfer test.
  async function seedIndependent(db: PotenovaDb, skillId: string) {
    const repo = new EvidenceRepository(db);
    for (let i = 0; i < reps.length; i++) {
      const ev: MasteryEvidence = {
        eventId: `seed-${skillId}-${i}`,
        learnerAlias: 'kid1',
        skillId,
        mode: 'independent_check',
        assistanceBand: 'A0',
        correct: true,
        representation: reps[i],
        recognitionConfidence: 1,
        observedAt: '2026-10-18T00:00:00.000Z',
        curriculumReleaseId: 'REL-ONT-LANG-2023-draft',
        schemaVersion: 'evt-0.1',
      };
      await repo.appendEvidence(ev);
    }
  }

  it('drives a generated-only skill (regular past tense) to TRANSFERABLE', async () => {
    const app = await onboard();
    const db = dbs[dbs.length - 1]!;
    // The one skill is already independent → the planner's next move is a transfer check.
    await seedIndependent(db, 'SK-EN-past-regular');

    const start = await (
      await app.request(
        '/learners/kid1/sessions',
        json(child, { subject: 'english', strand: 'past-tense', requestedMinutes: 20 }),
      )
    ).json();
    const sessionId = start.session.sessionId as string;

    // The planner offers a TRANSFER_CHECK on the generated transfer item (novel stretch).
    expect(start.next.skillId).toBe('SK-EN-past-regular');
    expect(start.next.reasonCode).toBe('TRANSFER_CHECK');
    const taskId = start.next.defaultTaskId as string;
    expect(isTransferTask(taskId)).toBe(true);

    // A correct transfer answer lifts the skill to TRANSFERABLE and completes the
    // single-skill session.
    const task = resolveTask(taskId);
    const body = await (
      await app.request(
        `/learners/kid1/sessions/${sessionId}/answer`,
        json(child, { clientSubmissionId: 'xfer', taskId, answer: correctAnswerFor(task) }),
      )
    ).json();
    expect(body.correct).toBe(true);
    expect(body.skillId).toBe('SK-EN-past-regular');
    expect(body.projection.state).toBe('TRANSFERABLE');
    expect(body.sessionComplete).toBe(true);
  });
});
