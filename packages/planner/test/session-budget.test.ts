import { describe, it, expect } from 'vitest';
import { sessionBudgetStatus, DRAFT_PLANNER_POLICY } from '../src';

// DRAFT: maxSessionItems = 8, maxNewConceptsPerSession = 2.
const policy = DRAFT_PLANNER_POLICY;

describe('sessionBudgetStatus', () => {
  it('tracks items remaining and flags the ceiling', () => {
    expect(
      sessionBudgetStatus({ itemsDelivered: 3, distinctSkillsThisSession: [] }, policy),
    ).toMatchObject({ itemsRemaining: 5, itemCeilingReached: false, allowed: true, reason: 'OK' });
    expect(
      sessionBudgetStatus({ itemsDelivered: 8, distinctSkillsThisSession: ['a', 'b'] }, policy),
    ).toMatchObject({
      itemsRemaining: 0,
      itemCeilingReached: true,
      allowed: false,
      reason: 'ITEM_CEILING',
    });
  });

  it('allows an already-introduced concept within the item budget', () => {
    const s = sessionBudgetStatus(
      { itemsDelivered: 4, distinctSkillsThisSession: ['a', 'b'], candidateSkillId: 'a' },
      policy,
    );
    expect(s.candidateIsNewConcept).toBe(false);
    expect(s.allowed).toBe(true);
  });

  it('blocks a THIRD new concept once the per-session cap is reached', () => {
    const s = sessionBudgetStatus(
      { itemsDelivered: 4, distinctSkillsThisSession: ['a', 'b'], candidateSkillId: 'c' },
      policy,
    );
    expect(s.conceptsIntroduced).toBe(2);
    expect(s.conceptsRemaining).toBe(0);
    expect(s.candidateIsNewConcept).toBe(true);
    expect(s.newConceptBlocked).toBe(true);
    expect(s.reason).toBe('CONCEPT_BUDGET');
  });

  it('the item ceiling takes precedence over the concept check', () => {
    const s = sessionBudgetStatus(
      { itemsDelivered: 8, distinctSkillsThisSession: ['a', 'b'], candidateSkillId: 'c' },
      policy,
    );
    expect(s.reason).toBe('ITEM_CEILING');
  });

  it('surfaces the uncalibrated DRAFT policy version', () => {
    const s = sessionBudgetStatus({ itemsDelivered: 0, distinctSkillsThisSession: [] }, policy);
    expect(s.policyVersion).toContain('DRAFT');
  });
});
