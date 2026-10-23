import { describe, it, expect } from 'vitest';
import { checkComposeHctoTask, composeHctoValue, type ComposeHctoTask } from '@potenova/content';

const t = (
  hundreds: number,
  tens: number,
  ones: number,
  claimedValue: number,
): ComposeHctoTask => ({
  kind: 'compose_hcto',
  hundreds,
  tens,
  ones,
  claimedValue,
});

describe('deterministic hundreds-tens-ones compose oracle (G2 B1.2; CONT-001/003, NFR-07)', () => {
  it('composes by place value', () => {
    expect(composeHctoValue(1, 2, 3)).toBe(123);
    expect(composeHctoValue(1, 0, 5)).toBe(105);
    expect(composeHctoValue(2, 0, 0)).toBe(200);
  });

  it('passes a correct composition', () => {
    expect(checkComposeHctoTask(t(1, 4, 6, 146))).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('detects the add-the-counts error (1 hundred 2 tens 3 ones called 6)', () => {
    const r = checkComposeHctoTask(t(1, 2, 3, 6));
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('detects the dropped-zero-place error (1 hundred 0 tens 5 ones called 15)', () => {
    expect(checkComposeHctoTask(t(1, 0, 5, 15)).reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed above the $200 bound and on an out-of-range digit', () => {
    expect(checkComposeHctoTask(t(2, 1, 0, 210)).ran).toBe(false); // 210 > 200
    expect(checkComposeHctoTask(t(1, 12, 0, 220)).reason).toBe('MALFORMED_TASK'); // tens > 9
  });
});
