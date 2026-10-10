import { describe, it, expect } from 'vitest';
import { buildDashboard, whyThisToday } from '@potenova/parent';
import type { SkillProjection } from '@potenova/learner-state';

const proj = (over: Partial<SkillProjection> = {}): SkillProjection => ({
  learnerAlias: 'lnr',
  skillId: 'SK-FR-unit',
  state: 'INDEPENDENT',
  dimensions: {
    independent: true,
    retained: false,
    transferable: false,
    representationsCovered: 2,
    unaidedCorrect: 3,
  },
  confidence: 0.75,
  policyVersion: 'mastery-DRAFT-0.1',
  curriculumReleaseId: 'REL-ONT-MATH-2020-draft',
  evidenceCount: 4,
  ...over,
});

describe('parent dashboard (PAR-001/010/016)', () => {
  it('maps projections to parent-friendly standings with no predicted grade field', () => {
    const d = buildDashboard('lnr', [
      proj(),
      proj({ skillId: 'SK-FR-compare', state: 'UNASSESSED', confidence: 0 }),
    ]);
    expect(d.rows[0]!.standing).toBe('demonstrated');
    expect(d.rows[1]!.standing).toBe('unknown');
    // PAR-001: the row carries evidence, never a predicted report-card grade
    expect(Object.keys(d.rows[0]!)).not.toContain('predictedGrade');
    expect(Object.keys(d.rows[0]!)).toEqual(['skillId', 'standing', 'confidence', 'evidenceCount']);
  });

  it('PAR-016: "Why this today?" exposes a reason code only, no chain-of-thought', () => {
    const w = whyThisToday('PREREQUISITE_REMEDIATION');
    expect(w.reasonCode).toBe('PREREQUISITE_REMEDIATION');
    expect(w.exposesChainOfThought).toBe(false);
  });
});
