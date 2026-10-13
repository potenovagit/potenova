import { describe, it, expect } from 'vitest';
import { stallStatus, DRAFT_PLANNER_POLICY } from '../src';

// DRAFT policy stallAttempts = 2.
const policy = DRAFT_PLANNER_POLICY;

describe('stallStatus', () => {
  it('counts only the trailing run of wrong attempts', () => {
    expect(stallStatus([false, false], policy)).toEqual({ consecutiveWrong: 2, stalled: true });
    expect(stallStatus([true, false, false], policy)).toEqual({
      consecutiveWrong: 2,
      stalled: true,
    });
  });

  it('a correct answer resets the run', () => {
    expect(stallStatus([false, false, true], policy)).toEqual({
      consecutiveWrong: 0,
      stalled: false,
    });
  });

  it('is not stalled below the threshold', () => {
    expect(stallStatus([false], policy)).toEqual({ consecutiveWrong: 1, stalled: false });
    expect(stallStatus([], policy)).toEqual({ consecutiveWrong: 0, stalled: false });
  });
});
