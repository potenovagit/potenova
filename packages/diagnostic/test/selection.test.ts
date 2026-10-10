import { describe, it, expect } from 'vitest';
import {
  selectNextProbe,
  scoreCandidate,
  scoreAll,
  DRAFT_DIAGNOSTIC_POLICY,
  type DiagnosticCandidate,
} from '@potenova/diagnostic';

const cand = (over: Partial<DiagnosticCandidate> = {}): DiagnosticCandidate => ({
  skillId: 'SK-FR-unit',
  grade: 3,
  priorConfidence: 0,
  priorState: 'UNASSESSED',
  representationsCovered: 0,
  foundationalFanout: 1,
  valid: true,
  ...over,
});

const policy = DRAFT_DIAGNOSTIC_POLICY;

describe('information-gain probe selection (DIA-001/006/012)', () => {
  it('DIA-012: an invalid (miscalibrated/inaccessible) task is never selectable', () => {
    expect(scoreCandidate(cand({ valid: false }), 3, policy)).toBe(Number.NEGATIVE_INFINITY);
    const picked = selectNextProbe([cand({ valid: false })], 3, policy);
    expect(picked).toBeNull();
  });

  it('DIA-002/AT-06: an already-resolved skill scores 0 (not reassessed)', () => {
    expect(scoreCandidate(cand({ priorConfidence: 0.9 }), 3, policy)).toBe(0);
  });

  it('prefers the lower-confidence, more foundational skill (higher information gain)', () => {
    const weak = cand({ skillId: 'SK-FR-unit', priorConfidence: 0.1, foundationalFanout: 4 });
    const strong = cand({ skillId: 'SK-FR-order', priorConfidence: 0.6, foundationalFanout: 1 });
    const picked = selectNextProbe([strong, weak], 3, policy);
    expect(picked?.skillId).toBe('SK-FR-unit');
  });

  it('breaks ties deterministically by skillId', () => {
    const a = cand({ skillId: 'SK-A' });
    const b = cand({ skillId: 'SK-B' });
    const ranked = scoreAll([b, a], 3, policy);
    expect(ranked[0]?.candidate.skillId).toBe('SK-A');
  });

  it('returns null when no candidate clears the minimum probe score (→ stop)', () => {
    // all skills confidently resolved
    const resolved = [
      cand({ priorConfidence: 0.95 }),
      cand({ skillId: 'SK-FR-compare', priorConfidence: 0.9 }),
    ];
    expect(selectNextProbe(resolved, 3, policy)).toBeNull();
  });
});
