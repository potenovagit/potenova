import { describe, it, expect } from 'vitest';
import {
  coachWriting,
  assertNotGhostwriting,
  writingHomeworkRequest,
  WRITING_RUBRIC,
} from '@potenova/english';
import { isDomainError } from '@potenova/contracts';

describe('writing coach (Product §5; AT-19)', () => {
  it('coaches per rubric dimension and never carries rewritten submission text', () => {
    const fb = coachWriting(['organization', 'conventions']);
    expect(fb.map((f) => f.dimension)).toEqual(['organization', 'conventions']);
    expect(fb.every((f) => f.rewritesSubmission === false)).toBe(true);
  });

  it('the rubric covers the full Product §5 writing dimensions', () => {
    expect(WRITING_RUBRIC).toContain('ideas');
    expect(WRITING_RUBRIC).toContain('audience_purpose');
    expect(WRITING_RUBRIC).toContain('independence');
  });

  it('allows coaching response kinds but refuses to produce the submitted work', () => {
    for (const kind of [
      'explain',
      'ask_question',
      'model_separate_example',
      'guide_revision',
    ] as const) {
      expect(() => assertNotGhostwriting(kind)).not.toThrow();
    }
    try {
      assertNotGhostwriting('produce_submission');
      throw new Error('expected POLICY_BLOCKED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });

  it('AT-19: "write my essay" becomes analogous coaching, not completion', () => {
    const r = writingHomeworkRequest();
    expect(r.mode).toBe('COACH_ANALOGOUS');
    expect(r.completesOriginal).toBe(false);
  });
});
