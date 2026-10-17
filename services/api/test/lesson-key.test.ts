import { describe, it, expect } from 'vitest';
import { deriveLessonKey } from '../src/adaptive';

/**
 * Server-side teaching-library key derivation (ADR-0021 follow-up). Misconception
 * comes from the authored KB (client value honoured only when valid); the
 * representation is the one the child most needs among the remediation's
 * representations, from their own evidence.
 */

describe('deriveLessonKey', () => {
  it('derives the KB misconception and the primary representation with no evidence', () => {
    const key = deriveLessonKey('fractions', 'SK-FR-compare', []);
    expect(key.misconceptionId).toBe('MC-FR-denom-size');
    expect(key.representation).toBe('area-model'); // authored primary strategy
  });

  it('picks the weakest representation among the remediation reps from evidence', () => {
    // Strong on area-model, nothing on number-line → number-line is weakest.
    const evidence = [
      { representation: 'area-model', correct: true },
      { representation: 'area-model', correct: true },
    ];
    const key = deriveLessonKey('fractions', 'SK-FR-compare', evidence);
    expect(key.representation).toBe('number-line');
  });

  it('ignores an invalid client misconception and uses the KB value', () => {
    const key = deriveLessonKey('fractions', 'SK-FR-compare', [], 'MC-XX-bogus');
    expect(key.misconceptionId).toBe('MC-FR-denom-size');
  });

  it('honours a valid client misconception for the skill', () => {
    const key = deriveLessonKey('fractions', 'SK-FR-compare', [], 'MC-FR-denom-size');
    expect(key.misconceptionId).toBe('MC-FR-denom-size');
  });

  it('returns nulls for a skill with no authored misconception', () => {
    // SK-FR-equiv has no misconception mapped in the KB → no key.
    const key = deriveLessonKey('fractions', 'SK-FR-equiv', []);
    expect(key.misconceptionId).toBeNull();
    expect(key.representation).toBeNull();
  });
});
