import { describe, it, expect } from 'vitest';
import { checkBuildNumberTask, builtValue, type BuildNumberTask } from '@potenova/content';

const build = (target: number, tens: number, ones: number): BuildNumberTask => ({
  kind: 'build_number',
  target,
  tens,
  ones,
});

describe('deterministic construction oracle (G1 B1.1/B1.2; CONT-001/003, NFR-07)', () => {
  it('computes the built value', () => {
    expect(builtValue(2, 4)).toBe(24);
    expect(builtValue(0, 24)).toBe(24);
  });

  it('accepts ANY valid decomposition of the target', () => {
    expect(checkBuildNumberTask(build(24, 2, 4)).correct).toBe(true); // standard
    expect(checkBuildNumberTask(build(24, 1, 14)).correct).toBe(true); // regrouped
    expect(checkBuildNumberTask(build(24, 0, 24)).correct).toBe(true); // all ones
  });

  it('AT-20: an off-by-a-place build (4 tens 2 ones for 24) is graded wrong', () => {
    const r = checkBuildNumberTask(build(24, 4, 2));
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed above the Grade 1 bound of 50 or on negative counts', () => {
    expect(checkBuildNumberTask(build(60, 6, 0))).toEqual({
      correct: false,
      ran: false,
      reason: 'MALFORMED_TASK',
    });
    expect(checkBuildNumberTask(build(24, -1, 34)).ran).toBe(false);
  });
});
