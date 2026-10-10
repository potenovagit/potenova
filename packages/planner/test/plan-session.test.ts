import { describe, it, expect } from 'vitest';
import {
  buildSessionPlan,
  assertSessionItemDeliverable,
  prioritize,
  DRAFT_PLANNER_POLICY,
  type ObjectiveSignal,
} from '@potenova/planner';
import { isDomainError } from '@potenova/contracts';

const policy = { ...DRAFT_PLANNER_POLICY, maxSessionItems: 4, maxNewConceptsPerSession: 1 };

const sig = (over: Partial<ObjectiveSignal>): ObjectiveSignal => ({
  skillId: 'SK',
  safetyBlocked: false,
  prerequisiteGap: false,
  highDependency: false,
  retentionRisk: false,
  masteryConfidence: 1,
  unresolvedConfidence: false,
  schoolPriority: false,
  isTransfer: false,
  isAdvancement: false,
  parentPreferred: false,
  ...over,
});

describe('adaptive session plan assembly (AI Learning §4)', () => {
  it('excludes suppressed (gated) objectives from the session', () => {
    const ranked = prioritize(
      [
        sig({ skillId: 'blocked', safetyBlocked: true }),
        sig({ skillId: 'pre', prerequisiteGap: true }),
      ],
      policy,
    );
    const plan = buildSessionPlan('sess-1', ranked, policy);
    expect(plan.items.map((i) => i.skillId)).toEqual(['pre']);
    expect(plan.suppressedSkillIds).toContain('blocked');
  });

  it('caps new-concept introduction and reports what was deferred', () => {
    const ranked = prioritize(
      [
        sig({ skillId: 'adv1', isAdvancement: true }),
        sig({ skillId: 'adv2', isAdvancement: true }),
        sig({ skillId: 'tr1', isTransfer: true }),
      ],
      policy,
    );
    const plan = buildSessionPlan('sess-1', ranked, policy);
    const newConceptItems = plan.items.filter((i) => i.isNewConcept);
    expect(newConceptItems).toHaveLength(1); // maxNewConceptsPerSession
    expect(plan.droppedForBudget.length).toBe(2);
  });

  it('bounds the session to the item ceiling', () => {
    const ranked = prioritize(
      Array.from({ length: 6 }, (_, i) => sig({ skillId: `p${i}`, prerequisiteGap: true })),
      policy,
    );
    const plan = buildSessionPlan('sess-1', ranked, policy);
    expect(plan.items.length).toBe(policy.maxSessionItems);
    expect(plan.droppedForBudget.length).toBe(2);
    expect(plan.planVersion).toBe(policy.policyVersion);
  });

  it('WP-05 boundary: a session item is only deliverable from validated content', () => {
    expect(() => assertSessionItemDeliverable('APPROVED_FOR_USE')).not.toThrow();
    try {
      assertSessionItemDeliverable('GENERATED');
      throw new Error('expected POLICY_BLOCKED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });
});
