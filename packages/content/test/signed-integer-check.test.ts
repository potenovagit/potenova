import { describe, it, expect } from 'vitest';
import { checkSignedIntegerCompareTask, signedRelation } from '@potenova/content';

describe('deterministic signed-integer comparison oracle (G6 exp 2; CONT-001/003, NFR-07)', () => {
  it('compares integers including negatives', () => {
    expect(signedRelation(-5, -2)).toBe('lt');
    expect(signedRelation(3, -8)).toBe('gt');
    expect(signedRelation(-7, -7)).toBe('eq');
    expect(signedRelation(0, -4)).toBe('gt');
  });

  it('detects the larger-magnitude-is-larger error (−5 vs −2 called gt)', () => {
    const r = checkSignedIntegerCompareTask({
      kind: 'integer_signed_compare',
      left: -5,
      right: -2,
      claimedRelation: 'gt',
    });
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('passes a correct verdict (−5 < −2 → lt)', () => {
    expect(
      checkSignedIntegerCompareTask({
        kind: 'integer_signed_compare',
        left: -5,
        right: -2,
        claimedRelation: 'lt',
      }).correct,
    ).toBe(true);
  });

  it('fails closed outside ±1000 or on a bad relation', () => {
    expect(
      checkSignedIntegerCompareTask({
        kind: 'integer_signed_compare',
        left: -2000,
        right: 5,
        claimedRelation: 'lt',
      }).ran,
    ).toBe(false);
    expect(
      checkSignedIntegerCompareTask({
        kind: 'integer_signed_compare',
        left: -5,
        right: -2,
        claimedRelation: 'bad' as 'lt',
      }).reason,
    ).toBe('MALFORMED_TASK');
  });
});
