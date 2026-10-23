import { describe, it, expect } from 'vitest';
import { checkWordProblemTask, wordProblemResult, type WordProblemTask } from '@potenova/content';

const wp = (a: number, op: '+' | '-', b: number, claimed: number): WordProblemTask => ({
  kind: 'word_problem',
  a,
  b,
  op,
  claimed,
});

describe('deterministic word-problem oracle (G1 B2.4/B2.5; CONT-001/003, NFR-07)', () => {
  it('computes the templated situation (whole-number result)', () => {
    expect(wordProblemResult(5, '+', 3)).toBe(8);
    expect(wordProblemResult(7, '-', 2)).toBe(5);
    expect(wordProblemResult(2, '-', 5)).toBeNull(); // would go negative
  });

  it('passes a correct answer to the story', () => {
    expect(checkWordProblemTask(wp(5, '+', 3, 8))).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('AT-20: the wrong-operation slip (adding when the story takes away) is detected', () => {
    // "7 birds, 2 fly away" is 5; answering 9 (added) is wrong.
    const r = checkWordProblemTask(wp(7, '-', 2, 9));
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed on a situation that would go negative', () => {
    expect(checkWordProblemTask(wp(2, '-', 5, -3))).toEqual({
      correct: false,
      ran: false,
      reason: 'MALFORMED_TASK',
    });
  });
});
