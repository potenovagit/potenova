import { describe, it, expect } from 'vitest';
import {
  checkCodeReachSelectTask,
  runProgram,
  reachingProgramIndices,
  type CodeReachSelectTask,
  type Move,
} from '@potenova/content';

const prog = (...m: Move[]): Move[] => m;

describe('deterministic coding oracle (G1 C3.1/C3.2; CONT-001/003, NFR-07)', () => {
  it('executes a program on the grid, returning null if it steps off', () => {
    expect(runProgram({ r: 0, c: 0 }, prog('right', 'right'), 3, 3)).toEqual({ r: 0, c: 2 });
    expect(runProgram({ r: 0, c: 0 }, prog('up'), 3, 3)).toBeNull(); // off the top
  });

  it('finds the one program that reaches the goal', () => {
    const task: CodeReachSelectTask = {
      kind: 'code_reach_select',
      rows: 3,
      cols: 3,
      start: { r: 0, c: 0 },
      goal: { r: 0, c: 2 },
      options: [prog('right', 'right'), prog('right'), prog('down', 'right')],
      claimedIndex: 0,
    };
    expect(reachingProgramIndices(task)).toEqual([0]);
    expect(checkCodeReachSelectTask(task)).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('AT-20: a program with the right moves in the wrong order is graded wrong', () => {
    const task: CodeReachSelectTask = {
      kind: 'code_reach_select',
      rows: 3,
      cols: 3,
      start: { r: 0, c: 0 },
      goal: { r: 0, c: 2 },
      options: [prog('right', 'right'), prog('down', 'right')],
      claimedIndex: 1,
    };
    const r = checkCodeReachSelectTask(task);
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed when no option (or more than one) reaches the goal', () => {
    const none: CodeReachSelectTask = {
      kind: 'code_reach_select',
      rows: 3,
      cols: 3,
      start: { r: 0, c: 0 },
      goal: { r: 2, c: 2 },
      options: [prog('right'), prog('down')],
      claimedIndex: 0,
    };
    expect(checkCodeReachSelectTask(none)).toEqual({
      correct: false,
      ran: false,
      reason: 'MALFORMED_TASK',
    });
    const two: CodeReachSelectTask = {
      kind: 'code_reach_select',
      rows: 3,
      cols: 3,
      start: { r: 0, c: 0 },
      goal: { r: 0, c: 1 },
      options: [prog('right'), prog('right')], // both reach
      claimedIndex: 0,
    };
    expect(checkCodeReachSelectTask(two).ran).toBe(false);
  });
});
