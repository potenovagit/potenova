import { describe, it, expect } from 'vitest';
import { checkGcfPairTask, checkLcmPairTask, gcd, lcm } from '@potenova/content';

describe('deterministic GCF / LCM oracle (G7 B2.6; CONT-001/003, NFR-07)', () => {
  it('computes gcd and lcm exactly (Euclid)', () => {
    expect(gcd(12, 18)).toBe(6);
    expect(gcd(144, 60)).toBe(12);
    expect(gcd(7, 13)).toBe(1); // coprime
    expect(lcm(4, 6)).toBe(12);
    expect(lcm(8, 12)).toBe(24);
    expect(lcm(5, 5)).toBe(5);
  });

  it('grades GCF and LCM answers', () => {
    expect(checkGcfPairTask({ kind: 'gcf_pair', a: 12, b: 18, claimedResult: 6 })).toMatchObject({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
    expect(checkLcmPairTask({ kind: 'lcm_pair', a: 4, b: 6, claimedResult: 24 })).toMatchObject({
      correct: false,
      ran: true,
      reason: 'ANSWER_KEY_WRONG',
    });
  });

  it('grades the "confused GCF with LCM" error wrong (GCF of 4,6 is 2 not 12)', () => {
    expect(checkGcfPairTask({ kind: 'gcf_pair', a: 4, b: 6, claimedResult: 12 }).correct).toBe(
      false,
    );
  });

  it('fails closed on out-of-range numbers and a non-positive claim', () => {
    expect(checkGcfPairTask({ kind: 'gcf_pair', a: 145, b: 18, claimedResult: 1 }).ran).toBe(false);
    expect(checkLcmPairTask({ kind: 'lcm_pair', a: 4, b: 6, claimedResult: 0 }).ran).toBe(false);
  });
});
