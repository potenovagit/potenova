import { describe, it, expect } from 'vitest';
import {
  decideStop,
  DRAFT_DIAGNOSTIC_POLICY,
  type DiagnosticCandidate,
} from '@potenova/diagnostic';

const policy = DRAFT_DIAGNOSTIC_POLICY;

const cand = (over: Partial<DiagnosticCandidate> = {}): DiagnosticCandidate => ({
  skillId: 'SK-FR-unit',
  grade: 3,
  priorConfidence: 0,
  priorState: 'UNASSESSED',
  representationsCovered: 0,
  foundationalFanout: 2,
  valid: true,
  ...over,
});

describe('stopping rule (DIA-006, AT-05/07)', () => {
  it('CONTINUE while a worthwhile probe remains, naming the next skill', () => {
    const d = decideStop({
      candidates: [cand({ skillId: 'SK-FR-unit', priorConfidence: 0.1 })],
      learnerGrade: 3,
      probesUsed: 2,
      ageCeilingReached: false,
      policy,
    });
    expect(d.kind).toBe('CONTINUE');
    if (d.kind === 'CONTINUE') expect(d.nextSkillId).toBe('SK-FR-unit');
  });

  it('SUFFICIENT once every skill is confidently resolved (not a fixed count)', () => {
    const d = decideStop({
      candidates: [cand({ priorConfidence: 0.95 })],
      learnerGrade: 3,
      probesUsed: 1,
      ageCeilingReached: false,
      policy,
    });
    expect(d.kind).toBe('SUFFICIENT');
  });

  it('AT-07: hitting the age ceiling stops PARTIAL with explicit unknowns, no failure label', () => {
    const d = decideStop({
      candidates: [cand({ skillId: 'SK-FR-compare', priorConfidence: 0.2 })],
      learnerGrade: 8,
      probesUsed: 3,
      ageCeilingReached: true,
      policy,
    });
    expect(d.kind).toBe('PARTIAL');
    if (d.kind === 'PARTIAL') {
      expect(d.reason).toBe('AGE_CEILING');
      expect(d.unresolvedSkillIds).toContain('SK-FR-compare');
    }
  });

  it('exhausting the attention budget stops PARTIAL (learner constraint)', () => {
    const d = decideStop({
      candidates: [cand({ priorConfidence: 0.1 })],
      learnerGrade: 3,
      probesUsed: policy.attentionBudget,
      ageCeilingReached: false,
      policy,
    });
    expect(d.kind).toBe('PARTIAL');
    if (d.kind === 'PARTIAL') expect(d.reason).toBe('ATTENTION_BUDGET');
  });
});
