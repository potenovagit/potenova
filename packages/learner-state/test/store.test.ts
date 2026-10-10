import { describe, it, expect } from 'vitest';
import { LearnerStateStore, type MasteryEvidence } from '@potenova/learner-state';
import { type ActorContext, isDomainError } from '@potenova/contracts';

const producer: ActorContext = {
  actorType: 'evidence_producer',
  actorAlias: 'ep-1',
  familyAlias: 'F1',
  learnerAlias: 'L1',
  purpose: 'evidence_projection',
};
const parent: ActorContext = { ...producer, actorType: 'guardian', purpose: 'parent_reporting' };

let seq = 0;
function ev(skillId: string, overrides: Partial<MasteryEvidence> = {}): MasteryEvidence {
  seq += 1;
  return {
    eventId: `s${seq}`,
    learnerAlias: 'L1',
    skillId,
    mode: 'independent_check',
    assistanceBand: 'A0',
    correct: true,
    representation: 'area-model',
    recognitionConfidence: 0.95,
    observedAt: '2026-10-01T09:00:00.000Z',
    curriculumReleaseId: 'REL-ONT-MATH-2020-draft',
    schemaVersion: 'evidence-1',
    ...overrides,
  };
}

/** Ingest three diverse unaided correct observations → INDEPENDENT. */
function makeIndependent(store: LearnerStateStore, skill: string) {
  store.ingest(producer, ev(skill, { representation: 'area-model' }));
  store.ingest(producer, ev(skill, { representation: 'number-line' }));
  store.ingest(producer, ev(skill, { representation: 'symbolic' }));
}

describe('learner-state store (LRN-003, AT-13/56/60, C-08/09/10)', () => {
  it('AT-56: tutor, parent and billing have NO path to set mastery', () => {
    const store = new LearnerStateStore();
    for (const t of ['guardian', 'tutor_engine', 'billing_service'] as const) {
      try {
        store.ingest({ ...parent, actorType: t }, ev('SK-A'));
        throw new Error('expected FORBIDDEN_ROLE');
      } catch (e) {
        expect(isDomainError(e) && e.code).toBe('FORBIDDEN_ROLE');
      }
    }
    // and there is simply no setState API — state only ever comes from replay
    expect(store.getState('L1', 'SK-A').state).toBe('UNASSESSED');
  });

  it('promotes to INDEPENDENT only through evidence replay', () => {
    const store = new LearnerStateStore();
    makeIndependent(store, 'SK-A');
    const s = store.getState('L1', 'SK-A');
    expect(s.state).toBe('INDEPENDENT');
    expect(s.projectionVersion).toBeGreaterThan(0);
  });

  it('AT-13: evidence on one skill never changes another skill’s state', () => {
    const store = new LearnerStateStore();
    makeIndependent(store, 'SK-A');
    store.ingest(producer, ev('SK-B', { assistanceBand: 'A5' })); // one guided obs on B
    expect(store.getState('L1', 'SK-A').state).toBe('INDEPENDENT');
    expect(store.getState('L1', 'SK-B').state).not.toBe('INDEPENDENT');
  });

  it('is idempotent on a replayed eventId (AT-27)', () => {
    const store = new LearnerStateStore();
    const e = ev('SK-A');
    store.ingest(producer, e);
    store.ingest(producer, e);
    expect(store.shadow('L1', 'SK-A').evidenceCount).toBe(1);
  });

  it('corrections append and reproject without leaving stale mastery (AT-25/60)', () => {
    const store = new LearnerStateStore();
    const first = ev('SK-A', { eventId: 'area-obs', representation: 'area-model' });
    store.ingest(producer, first);
    store.ingest(producer, ev('SK-A', { representation: 'number-line' }));
    store.ingest(producer, ev('SK-A', { representation: 'symbolic' }));
    expect(store.getState('L1', 'SK-A').state).toBe('INDEPENDENT');

    // retract one representation via a correction → drops below INDEPENDENT
    store.correct(producer, 'L1', {
      correctionId: 'c1',
      targetEventId: 'area-obs', // the area-model observation
      reason: 'disputed marking',
      retract: true,
      createdAt: '2026-10-02T09:00:00.000Z',
    });

    const after = store.getState('L1', 'SK-A');
    expect(after.state).not.toBe('INDEPENDENT'); // stored state moved with the evidence
    // AT-60: stored state matches a fresh replay — no regressed/stale projection lingers
    expect(store.reconcile('L1', 'SK-A').match).toBe(true);
  });

  it('a correction must target an existing event', () => {
    const store = new LearnerStateStore();
    store.ingest(producer, ev('SK-A'));
    try {
      store.correct(producer, 'L1', {
        correctionId: 'c1',
        targetEventId: 'missing',
        reason: 'x',
        retract: true,
        createdAt: '2026-10-02T09:00:00.000Z',
      });
      throw new Error('expected NOT_FOUND');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('NOT_FOUND');
    }
  });

  it('shadow projection never mutates stored state (C-09)', () => {
    const store = new LearnerStateStore();
    store.ingest(producer, ev('SK-A', { assistanceBand: 'A5' }));
    const before = store.getState('L1', 'SK-A').projectionVersion;
    store.shadow('L1', 'SK-A');
    store.shadow('L1', 'SK-A');
    expect(store.getState('L1', 'SK-A').projectionVersion).toBe(before);
  });
});
