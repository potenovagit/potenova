import { describe, it, expect } from 'vitest';
import {
  generateInitialPlan,
  assertProbeDeliverable,
  buildBaselineProfile,
  DRAFT_DIAGNOSTIC_POLICY,
} from '@potenova/diagnostic';
import { buildFractionsDraftGraph } from '@potenova/curriculum';
import { isDomainError } from '@potenova/contracts';

describe('initial learning-plan generation (DIA-007/008)', () => {
  const graph = buildFractionsDraftGraph();
  const targets = ['SK-FR-compare'];
  const profileSkills = [
    'SK-FR-partition',
    'SK-FR-unit',
    'SK-FR-nonunit',
    'SK-FR-equiv',
    'SK-FR-compare',
  ];

  it('orders confirmed prerequisites before the target objective, with reason codes', () => {
    const profile = buildBaselineProfile('lnr-alias', profileSkills, []); // no history
    const plan = generateInitialPlan('run-1', profile, graph, targets, DRAFT_DIAGNOSTIC_POLICY);

    // first item is a prerequisite remediation (a root of the compare closure)
    expect(plan.items[0]!.reasonCode).toBe('PREREQUISITE_REMEDIATION');
    expect(['SK-FR-partition', 'SK-FR-unit', 'SK-FR-nonunit', 'SK-FR-equiv']).toContain(
      plan.items[0]!.skillId,
    );

    // the target itself is not in its own prerequisite closure → verification, not remediation
    const compare = plan.items.find((i) => i.skillId === 'SK-FR-compare')!;
    expect(compare.reasonCode).toBe('LOW_CONFIDENCE_VERIFICATION');
  });

  it('DIA-007: surfaces confidence limitations and unknowns to the parent', () => {
    const profile = buildBaselineProfile('lnr-alias', profileSkills, []);
    const plan = generateInitialPlan('run-1', profile, graph, targets, DRAFT_DIAGNOSTIC_POLICY);
    expect(plan.hasUnknowns).toBe(true);
    expect(plan.items.every((i) => i.confidenceLimited)).toBe(true);
    expect(plan.planVersion).toBe(DRAFT_DIAGNOSTIC_POLICY.policyVersion);
  });

  it('WP-05 boundary: a probe may only use validated, deliverable content', () => {
    expect(() => assertProbeDeliverable('APPROVED_FOR_USE')).not.toThrow();
    expect(() => assertProbeDeliverable('REVIEWED_REUSABLE')).not.toThrow();
    for (const s of ['GENERATED', 'VALIDATION_PENDING', 'QUARANTINED'] as const) {
      try {
        assertProbeDeliverable(s);
        throw new Error('expected POLICY_BLOCKED');
      } catch (e) {
        expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
      }
    }
  });
});
