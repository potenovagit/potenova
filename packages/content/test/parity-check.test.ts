import { describe, it, expect } from 'vitest';
import { checkParityTask, parityOf, type ParityTask } from '@potenova/content';

const p = (n: number, claimed: 'even' | 'odd'): ParityTask => ({
  kind: 'number_parity',
  n,
  claimed,
});

describe('deterministic even/odd oracle (G2 B1.5; CONT-001/003, NFR-07)', () => {
  it('decides parity by the number', () => {
    expect(parityOf(10)).toBe('even');
    expect(parityOf(7)).toBe('odd');
    expect(parityOf(0)).toBe('even');
  });

  it('passes a correct even/odd call', () => {
    expect(checkParityTask(p(10, 'even'))).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('AT-20: the first-digit trap (23 called even because 2 is even) is detected', () => {
    const r = checkParityTask(p(23, 'even'));
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed on a negative/non-integer number or a bad claim', () => {
    expect(checkParityTask(p(-2, 'even')).ran).toBe(false);
    expect(checkParityTask({ kind: 'number_parity', n: 4, claimed: 'maybe' as 'even' })).toEqual({
      correct: false,
      ran: false,
      reason: 'MALFORMED_TASK',
    });
  });
});
