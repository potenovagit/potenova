import { describe, it, expect } from 'vitest';
import { buildBaselineProfile, placementEvidence, PLACEMENT_MODES } from '@potenova/diagnostic';
import type { MasteryEvidence, EvidenceMode } from '@potenova/learner-state';

const ev = (
  eventId: string,
  mode: EvidenceMode,
  representation: string,
  observedAt: string,
): MasteryEvidence => ({
  eventId,
  learnerAlias: 'lnr-alias',
  skillId: 'SK-FR-unit',
  mode,
  assistanceBand: 'A0',
  correct: true,
  representation,
  recognitionConfidence: 1,
  observedAt,
  curriculumReleaseId: 'REL-ONT-MATH-2020-draft',
  schemaVersion: 'evt-0.1',
});

describe('baseline profile + mode boundary (DIA-003/004/005/008, AT-05)', () => {
  it('AT-05: a learner with no history is UNASSESSED/unknown — never zero or failed', () => {
    const profile = buildBaselineProfile('lnr-alias', ['SK-FR-unit'], []);
    const only = profile.skills[0]!;
    expect(only.state).toBe('UNASSESSED');
    expect(only.standing).toBe('unknown');
    expect(only.confidence).toBe(0);
    expect(only.unknownDimensions).toEqual(['independent', 'retained', 'transferable']);
  });

  it('PLACEMENT_MODES admits assessment modes but excludes coached teaching', () => {
    expect(PLACEMENT_MODES.has('independent_check')).toBe(true);
    expect(PLACEMENT_MODES.has('diagnostic')).toBe(true);
    expect(PLACEMENT_MODES.has('teaching')).toBe(false);
  });

  it('independent-check evidence across representations reads as demonstrated', () => {
    const events = [
      ev('e1', 'independent_check', 'area-model', '2026-10-01T00:00:00Z'),
      ev('e2', 'independent_check', 'number-line', '2026-10-01T00:05:00Z'),
      ev('e3', 'independent_check', 'symbolic', '2026-10-01T00:10:00Z'),
    ];
    const profile = buildBaselineProfile('lnr-alias', ['SK-FR-unit'], events);
    expect(profile.skills[0]!.standing).toBe('demonstrated');
  });

  it('DIA-004/005: the SAME responses in teaching mode are NOT placement evidence', () => {
    const coached = [
      ev('t1', 'teaching', 'area-model', '2026-10-01T00:00:00Z'),
      ev('t2', 'teaching', 'number-line', '2026-10-01T00:05:00Z'),
      ev('t3', 'teaching', 'symbolic', '2026-10-01T00:10:00Z'),
    ];
    expect(placementEvidence(coached)).toHaveLength(0);
    const profile = buildBaselineProfile('lnr-alias', ['SK-FR-unit'], coached);
    // coached success is not relabeled as independent placement — stays unknown
    expect(profile.skills[0]!.standing).toBe('unknown');
  });
});
