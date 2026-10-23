import { describe, it, expect } from 'vitest';
import { checkCoinValueTask, coinTotalCents, type CoinValueTask } from '@potenova/content';

describe('deterministic coin/bill-value oracle (G1 F1.1; CONT-001/003, NFR-07)', () => {
  it('totals a set of Canadian pieces in cents', () => {
    expect(coinTotalCents([10, 5])).toBe(15);
    expect(coinTotalCents([25, 25])).toBe(50);
    expect(coinTotalCents([100, 25, 10])).toBe(135);
  });

  it('passes a correct total', () => {
    const good: CoinValueTask = { kind: 'coin_value', pieces: [10, 5], claimedTotalCents: 15 };
    expect(checkCoinValueTask(good)).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('AT-20: the count-the-pieces error (a dime + a nickel = "2") is detected', () => {
    const bad: CoinValueTask = { kind: 'coin_value', pieces: [10, 5], claimedTotalCents: 2 };
    const r = checkCoinValueTask(bad);
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed on a non-Canadian denomination (e.g. a 1¢ penny) or an empty set', () => {
    expect(
      checkCoinValueTask({ kind: 'coin_value', pieces: [10, 1], claimedTotalCents: 11 }),
    ).toEqual({ correct: false, ran: false, reason: 'MALFORMED_TASK' });
    expect(checkCoinValueTask({ kind: 'coin_value', pieces: [], claimedTotalCents: 0 }).ran).toBe(
      false,
    );
  });

  it('fails closed above the $50 Grade 1 bound', () => {
    expect(
      checkCoinValueTask({ kind: 'coin_value', pieces: [5000, 100], claimedTotalCents: 5100 }).ran,
    ).toBe(false);
  });
});
