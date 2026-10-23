import { describe, it, expect } from 'vitest';
import { checkCoinValueTask, coinTotalCents } from '@potenova/content';

/**
 * The money-to-$100 bound (Ontario G2 F1.1). Same deterministic coin_value
 * oracle; the only lever is the per-item `maxTotalCents`. A G2 item raises it to
 * 10000¢; the G1 default ($50) still rejects anything above $50.
 */
describe('coin_value bound raised to $100 (G2 F1.1; CONT-001/003, NFR-07)', () => {
  const pieces = [5000, 2000, 2000, 1000]; // $100 exactly
  const total = coinTotalCents(pieces);

  it('passes a $100 total when the item allows $100', () => {
    expect(
      checkCoinValueTask({
        kind: 'coin_value',
        pieces,
        claimedTotalCents: total,
        maxTotalCents: 10000,
      }),
    ).toEqual({ correct: true, ran: true, reason: 'ANSWER_KEY_CORRECT' });
  });

  it('fails closed on the same set under the default $50 bound', () => {
    expect(checkCoinValueTask({ kind: 'coin_value', pieces, claimedTotalCents: total }).ran).toBe(
      false,
    );
  });

  it('still fails closed above its own $100 bound', () => {
    const over = [5000, 5000, 2000]; // $120
    expect(
      checkCoinValueTask({
        kind: 'coin_value',
        pieces: over,
        claimedTotalCents: coinTotalCents(over),
        maxTotalCents: 10000,
      }).reason,
    ).toBe('MALFORMED_TASK');
  });

  it('grades the count-pieces trap wrong, not malformed', () => {
    const r = checkCoinValueTask({
      kind: 'coin_value',
      pieces,
      claimedTotalCents: pieces.length,
      maxTotalCents: 10000,
    });
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });
});
