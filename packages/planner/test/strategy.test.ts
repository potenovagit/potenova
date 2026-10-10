import { describe, it, expect } from 'vitest';
import {
  nextStrategy,
  evaluateResponse,
  shouldProbeReasoning,
  DRAFT_PLANNER_POLICY,
  type AttemptOutcome,
} from '@potenova/planner';

const policy = DRAFT_PLANNER_POLICY; // stallAttempts = 2
const miss = (): AttemptOutcome => ({ correct: false, progressed: false });
const win = (): AttemptOutcome => ({ correct: true, progressed: true });

describe('teaching-strategy engine (AI Learning §5; AT-08/16/17)', () => {
  it('continues the current strategy while progress is being made', () => {
    const d = nextStrategy('guided_practice', [win(), miss()], policy);
    expect(d.kind).toBe('CONTINUE');
  });

  it('AT-08: on a stall it SWITCHES strategy — never repeats the current one', () => {
    const d = nextStrategy('guided_practice', [miss(), miss()], policy);
    expect(d.kind).toBe('SWITCH');
    expect(d.strategy).not.toBe('guided_practice');
  });

  it('a stall on the first escalation choice still switches to a different strategy', () => {
    const d = nextStrategy('representational_shift', [miss(), miss(), miss()], policy);
    expect(d.kind).toBe('SWITCH');
    expect(d.strategy).not.toBe('representational_shift');
  });

  it('AT-17: a correct answer via a valid alternative path is accepted', () => {
    expect(evaluateResponse({ correct: true, usedApprovedAlternativePath: true })).toBe('accept');
    expect(evaluateResponse({ correct: false, usedApprovedAlternativePath: true })).toBe('reject');
  });

  it('AT-16: high guessing risk triggers a reasoning probe, not credit or punishment', () => {
    expect(shouldProbeReasoning({ correct: true, guessingRisk: true })).toBe(true);
    expect(shouldProbeReasoning({ correct: true, guessingRisk: false })).toBe(false);
  });
});
