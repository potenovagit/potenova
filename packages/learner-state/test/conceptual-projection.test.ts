import { describe, it, expect } from 'vitest';
import type { ActorContext } from '@potenova/contracts';
import {
  LearnerStateStore,
  ER03_CANDIDATE_V02,
  type MasteryEvidence,
} from '@potenova/learner-state';

/**
 * Conceptual mastery (ER-03) derived from the SAME immutable ledger as the
 * representation-based projection — the vertical path that wires the Stage-1/2
 * conceptual evaluator into the authoritative learner-state store. Mastery is
 * replay-derived; there is no setter. Synthetic only.
 */

const EQUIV = ER03_CANDIDATE_V02.skills['SK-FR-equiv']!;
const producer: ActorContext = {
  actorType: 'evidence_producer',
  actorAlias: 'coaching-engine',
  familyAlias: 'fam1',
  purpose: 'evidence_projection',
};
const reviewer: ActorContext = { ...producer, actorType: 'content_validator' };

let n = 0;
function eventFor(
  dimension: 'model' | 'value' | 'reasoning' | 'transfer',
  correct: boolean,
  o: {
    band?: MasteryEvidence['assistanceBand'];
    mode?: MasteryEvidence['mode'];
    rep?: string;
    family?: string;
    day?: number;
    grade?: number;
    session?: string;
  } = {},
): MasteryEvidence {
  n += 1;
  return {
    eventId: `ev-${n}`,
    learnerAlias: 'kid1',
    skillId: 'SK-FR-equiv',
    mode: o.mode ?? (dimension === 'transfer' ? 'transfer_check' : 'independent_check'),
    assistanceBand: o.band ?? 'A0',
    correct,
    representation: o.rep ?? 'area-model',
    recognitionConfidence: 1,
    observedAt: `2026-11-${String(o.day ?? 1).padStart(2, '0')}T10:00:00Z`,
    curriculumReleaseId: 'ont-2020',
    schemaVersion: '1',
    evidenceDimension: dimension,
    itemFamilyId: o.family ?? `fam-${dimension}-${n}`,
    gradeTarget: o.grade ?? 3,
    sessionId: o.session,
  };
}

/** A complete, independent conceptual master bundle for SK-FR-equiv G3. */
function masterBundle(): MasteryEvidence[] {
  n = 0;
  return [
    eventFor('model', true, { rep: 'area-model', family: 'm1', day: 1, session: 's1' }),
    eventFor('value', true, { rep: 'symbolic', family: 'v1', day: 1, session: 's1' }),
    eventFor('value', true, { rep: 'area-model', family: 'v2', day: 2, session: 's2' }),
    eventFor('reasoning', true, { rep: 'symbolic', family: 'r1', day: 2, session: 's2' }),
    eventFor('transfer', true, {
      mode: 'transfer_check',
      rep: 'number-line',
      family: 't1',
      day: 2,
      session: 's2',
    }),
  ];
}

function ingestAll(store: LearnerStateStore, events: MasteryEvidence[]): void {
  for (const e of events) store.ingest(producer, e);
}

describe('conceptual projection off the immutable ledger (ER-03)', () => {
  it('a complete bundle reaches INDEPENDENT via the grade-gated assessed-core projection', () => {
    const store = new LearnerStateStore();
    ingestAll(store, masterBundle());
    const r = store.conceptualProjection('kid1', EQUIV, { gradeTarget: 3 });
    expect(r.state).toBe('INDEPENDENT');
    expect(r.gradeTarget).toBe(3);
    expect(r.unmet).toHaveLength(0);
    for (const d of r.dimensions) expect(d.met).toBe(true);
  });

  it('assisted-only (A4) evidence never reaches INDEPENDENT (AT-09)', () => {
    const store = new LearnerStateStore();
    ingestAll(
      store,
      masterBundle().map((e) => ({ ...e, assistanceBand: 'A4' as const })),
    );
    const r = store.conceptualProjection('kid1', EQUIV, { gradeTarget: 3 });
    expect(r.state).toBe('NOT_YET_DEMONSTRATED');
    expect(r.eligibleCount).toBe(0);
  });

  it('a wrong reasoning answer withholds mastery even when the value is right', () => {
    const store = new LearnerStateStore();
    const evs = masterBundle();
    evs[3] = { ...evs[3]!, correct: false }; // reasoning wrong
    ingestAll(store, evs);
    const r = store.conceptualProjection('kid1', EQUIV, { gradeTarget: 3 });
    expect(r.state).toBe('NOT_YET_DEMONSTRATED');
    expect(r.unmet.some((u) => u.startsWith('reasoning'))).toBe(true);
  });

  it('the grade gate is fail-closed: Grade-3 evidence yields no Grade-5 mastery claim', () => {
    const store = new LearnerStateStore();
    ingestAll(store, masterBundle()); // tagged gradeTarget 3
    expect(store.conceptualProjection('kid1', EQUIV, { gradeTarget: 3 }).state).toBe('INDEPENDENT');
    expect(store.conceptualProjection('kid1', EQUIV, { gradeTarget: 5 }).state).toBe('UNKNOWN');
  });

  it('a retraction correction removes its event from the conceptual projection', () => {
    const store = new LearnerStateStore();
    const evs = masterBundle();
    ingestAll(store, evs);
    expect(store.conceptualProjection('kid1', EQUIV, { gradeTarget: 3 }).state).toBe('INDEPENDENT');
    // retract the transfer event — a disputed marking (AT-25)
    store.correct(reviewer, 'kid1', {
      correctionId: 'c1',
      targetEventId: evs[4]!.eventId,
      reason: 'disputed capture',
      retract: true,
      createdAt: '2026-11-03T00:00:00Z',
    });
    const r = store.conceptualProjection('kid1', EQUIV, { gradeTarget: 3 });
    expect(r.state).toBe('NOT_YET_DEMONSTRATED');
    expect(r.dimensions.find((d) => d.dimension === 'transfer')!.met).toBe(false);
  });

  it('non-conceptual evidence (no dimension) is ignored by the conceptual projection', () => {
    const store = new LearnerStateStore();
    const plain: MasteryEvidence = {
      eventId: 'plain-1',
      learnerAlias: 'kid1',
      skillId: 'SK-FR-equiv',
      mode: 'independent_check',
      assistanceBand: 'A0',
      correct: true,
      representation: 'area-model',
      recognitionConfidence: 1,
      observedAt: '2026-11-01T10:00:00Z',
      curriculumReleaseId: 'ont-2020',
      schemaVersion: '1',
    };
    store.ingest(producer, plain);
    expect(store.conceptualProjection('kid1', EQUIV, { gradeTarget: 3 }).state).toBe('UNKNOWN');
    ingestAll(store, masterBundle());
    expect(store.conceptualProjection('kid1', EQUIV, { gradeTarget: 3 }).state).toBe('INDEPENDENT');
  });
});
