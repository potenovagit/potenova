import { describe, it, expect } from 'vitest';
import {
  estimateCost,
  overDraftBudget,
  assertCostPayloadClean,
  DRAFT_UNIT_COST,
  DRAFT_SESSION_COST_BUDGET,
} from '../src/cost';

describe('AI cost estimation (DRAFT rate, AI-013/AI-014)', () => {
  it('derives cost from units at the DRAFT rate', () => {
    expect(estimateCost(0)).toBe(0);
    expect(estimateCost(1000)).toBeCloseTo(1000 * DRAFT_UNIT_COST);
  });

  it('flags usage over the DRAFT session budget', () => {
    const under = estimateCost(100);
    const over = estimateCost(Math.ceil((DRAFT_SESSION_COST_BUDGET / DRAFT_UNIT_COST) * 2));
    expect(overDraftBudget(under)).toBe(false);
    expect(overDraftBudget(over)).toBe(true);
  });

  it('rejects a cost payload carrying raw child content (C-32)', () => {
    expect(() => assertCostPayloadClean({ units: 5, provider: 'p' })).not.toThrow();
    expect(() => assertCostPayloadClean({ units: 5, transcript: 'hi' })).toThrow();
    expect(() => assertCostPayloadClean({ prompt: 'x' })).toThrow();
  });
});
