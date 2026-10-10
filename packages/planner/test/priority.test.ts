import { describe, it, expect } from 'vitest';
import {
  prioritize,
  classifyObjective,
  DRAFT_PLANNER_POLICY,
  type ObjectiveSignal,
} from '@potenova/planner';

const policy = DRAFT_PLANNER_POLICY;

const sig = (over: Partial<ObjectiveSignal> = {}): ObjectiveSignal => ({
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

describe('planner priority order (AI Learning §4; AT-29/56)', () => {
  it('a safety-gated objective is suppressed with SAFETY_LIMIT, not merely deprioritized', () => {
    const o = classifyObjective(sig({ safetyBlocked: true, prerequisiteGap: true }), policy);
    expect(o.reasonCode).toBe('SAFETY_LIMIT');
    expect(o.suppressed).toBe(true);
    expect(o.tier).toBe(1);
  });

  it('prerequisite gaps outrank school priority and advancement', () => {
    const ranked = prioritize(
      [
        sig({ skillId: 'adv', isAdvancement: true }),
        sig({ skillId: 'school', schoolPriority: true }),
        sig({ skillId: 'prereq', prerequisiteGap: true }),
      ],
      policy,
    );
    expect(ranked.map((o) => o.skillId)).toEqual(['prereq', 'school', 'adv']);
    expect(ranked[0]!.reasonCode).toBe('PREREQUISITE_REMEDIATION');
  });

  it('AT-29: parent preference reorders within a tier but never crosses a gate', () => {
    const ranked = prioritize(
      [
        sig({ skillId: 'prereq', prerequisiteGap: true }),
        sig({ skillId: 'adv-a', isAdvancement: true }),
        sig({ skillId: 'adv-b', isAdvancement: true, parentPreferred: true }),
      ],
      policy,
    );
    // the preferred advancement leads the other advancement, but stays below the prerequisite
    expect(ranked.map((o) => o.skillId)).toEqual(['prereq', 'adv-b', 'adv-a']);
  });

  it('low confidence routes to verification; mid confidence to a mastery check', () => {
    expect(classifyObjective(sig({ masteryConfidence: 0.2 }), policy).reasonCode).toBe(
      'LOW_CONFIDENCE_VERIFICATION',
    );
    expect(classifyObjective(sig({ masteryConfidence: 0.65 }), policy).reasonCode).toBe(
      'MASTERY_CHECK',
    );
  });

  it('retention risk is a REVIEW_DUE at tier 3', () => {
    const o = classifyObjective(sig({ retentionRisk: true }), policy);
    expect(o.reasonCode).toBe('REVIEW_DUE');
    expect(o.tier).toBe(3);
  });
});
