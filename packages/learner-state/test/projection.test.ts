import { describe, it, expect } from 'vitest';
import { projectShadow, type MasteryEvidence } from '@potenova/learner-state';

let seq = 0;
function ev(overrides: Partial<MasteryEvidence> = {}): MasteryEvidence {
  seq += 1;
  return {
    eventId: `e${seq}`,
    learnerAlias: 'L1',
    skillId: 'SK-FR-compare',
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

const project = (events: MasteryEvidence[]) => projectShadow('L1', 'SK-FR-compare', events);

describe('mastery projection (05 §2, State machine 3.1)', () => {
  it('AT-05: no evidence is UNASSESSED, never a failure or zero', () => {
    const p = project([]);
    expect(p.state).toBe('UNASSESSED');
    expect(p.confidence).toBe(0);
    expect(p.dimensions.unaidedCorrect).toBe(0);
  });

  it('AT-09: fully guided (A5) success never reaches INDEPENDENT', () => {
    const p = project([
      ev({ assistanceBand: 'A5', representation: 'area-model' }),
      ev({ assistanceBand: 'A5', representation: 'number-line' }),
      ev({ assistanceBand: 'A4', representation: 'symbolic' }),
    ]);
    expect(p.dimensions.independent).toBe(false);
    expect(p.state).toBe('DEVELOPING');
  });

  it('AT-10: diverse unaided evidence across representations reaches INDEPENDENT', () => {
    const p = project([
      ev({ representation: 'area-model' }),
      ev({ representation: 'number-line' }),
      ev({ representation: 'symbolic' }),
    ]);
    expect(p.state).toBe('INDEPENDENT');
    expect(p.dimensions.representationsCovered).toBe(3);
  });

  it('AT-10: a single repeated representation is insufficient for INDEPENDENT', () => {
    const p = project([
      ev({ representation: 'area-model' }),
      ev({ representation: 'area-model' }),
      ev({ representation: 'area-model' }),
    ]);
    expect(p.dimensions.independent).toBe(false);
    expect(p.state).toBe('DEVELOPING');
  });

  it('AT-11: a delayed independent retrieval advances to RETAINED; an immediate repeat does not', () => {
    const independent = [
      ev({ representation: 'area-model', observedAt: '2026-10-01T09:00:00.000Z' }),
      ev({ representation: 'number-line', observedAt: '2026-10-01T09:05:00.000Z' }),
      ev({ representation: 'symbolic', observedAt: '2026-10-01T09:10:00.000Z' }),
    ];
    // immediate repeat (same day) → still INDEPENDENT, not RETAINED
    const immediate = project([
      ...independent,
      ev({
        mode: 'retention_check',
        representation: 'area-model',
        observedAt: '2026-10-01T10:00:00.000Z',
      }),
    ]);
    expect(immediate.state).toBe('INDEPENDENT');

    // delayed (2 days later) → RETAINED
    const delayed = project([
      ...independent,
      ev({
        mode: 'retention_check',
        representation: 'area-model',
        observedAt: '2026-10-03T09:00:00.000Z',
      }),
    ]);
    expect(delayed.state).toBe('RETAINED');
  });

  it('AT-12: unaided success in a novel context reaches TRANSFERABLE', () => {
    const p = project([
      ev({ representation: 'area-model' }),
      ev({ representation: 'number-line' }),
      ev({ representation: 'symbolic' }),
      ev({
        mode: 'retention_check',
        representation: 'area-model',
        observedAt: '2026-10-03T09:00:00.000Z',
      }),
      ev({
        mode: 'transfer_check',
        representation: 'word-problem',
        observedAt: '2026-10-04T09:00:00.000Z',
      }),
    ]);
    expect(p.state).toBe('TRANSFERABLE');
  });

  it('contradiction after independence flags REVALIDATION_REQUIRED (history preserved)', () => {
    const p = project([
      ev({ representation: 'area-model', observedAt: '2026-10-01T09:00:00.000Z' }),
      ev({ representation: 'number-line', observedAt: '2026-10-01T09:05:00.000Z' }),
      ev({ representation: 'symbolic', observedAt: '2026-10-01T09:10:00.000Z' }),
      ev({ correct: false, representation: 'symbolic', observedAt: '2026-10-05T09:00:00.000Z' }),
    ]);
    expect(p.state).toBe('REVALIDATION_REQUIRED');
    expect(p.evidenceCount).toBe(4); // nothing dropped from history
  });

  it('AT-28: a low-recognition observation is not trusted for grading', () => {
    const p = project([
      ev({ representation: 'area-model' }),
      ev({ representation: 'number-line' }),
      ev({ representation: 'symbolic', recognitionConfidence: 0.4 }), // untrusted
    ]);
    // only 2 trusted unaided reps → not yet INDEPENDENT
    expect(p.dimensions.representationsCovered).toBe(2);
    expect(p.dimensions.independent).toBe(false);
  });
});
