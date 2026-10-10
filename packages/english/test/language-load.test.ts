import { describe, it, expect } from 'vitest';
import {
  mathUnderLanguageLoad,
  isHighLanguageLoad,
  DRAFT_ENGLISH_POLICY,
  type LanguageLoad,
} from '@potenova/english';

const policy = DRAFT_ENGLISH_POLICY; // threshold 0.7
const highLoad: LanguageLoad = { readingGradeLevel: 6, lexicalDensity: 0.85 };
const lowLoad: LanguageLoad = { readingGradeLevel: 2, lexicalDensity: 0.3 };

describe('language load vs Math mastery (AT-14)', () => {
  it('flags high language load', () => {
    expect(isHighLanguageLoad(highLoad, policy)).toBe(true);
    expect(isHighLanguageLoad(lowLoad, policy)).toBe(false);
  });

  it('AT-14: a miss on a high-language-load item flags reading support, never downgrades Math', () => {
    const d = mathUnderLanguageLoad({ mathCorrect: false, load: highLoad }, policy);
    expect(d.downgradeMath).toBe(false);
    expect(d.action).toBe('FLAG_READING_SUPPORT');
  });

  it('a correct answer always counts, whatever the language load', () => {
    expect(mathUnderLanguageLoad({ mathCorrect: true, load: highLoad }, policy).action).toBe(
      'SCORE_NORMALLY',
    );
  });

  it('a miss on an ordinary-language item is a genuine Math signal', () => {
    const d = mathUnderLanguageLoad({ mathCorrect: false, load: lowLoad }, policy);
    expect(d.action).toBe('SCORE_NORMALLY');
    expect(d.downgradeMath).toBe(true);
  });
});
