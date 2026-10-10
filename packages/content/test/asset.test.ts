import { describe, it, expect } from 'vitest';
import {
  transition,
  canTransition,
  isDeliverableState,
  type ContentAsset,
} from '@potenova/content';
import { isDomainError } from '@potenova/contracts';

const asset = (over: Partial<ContentAsset> = {}): ContentAsset => ({
  assetId: 'asset-1',
  assetVersion: 'v1',
  objectiveSkillIds: ['SK-FR-compare'],
  ageBand: 'junior',
  subject: 'math',
  provenance: 'ai_generated',
  state: 'GENERATED',
  producedBy: 'model-generator-1',
  curriculumReleaseId: 'REL-ONT-MATH-2020-draft',
  schemaVersion: 'content-0.1',
  ...over,
});

describe('ContentAsset lifecycle (§3.4; TM-09/TM-40)', () => {
  it('walks the generated validation path to APPROVED_FOR_USE', () => {
    let a = asset();
    a = transition(a, 'VALIDATION_PENDING');
    a = transition(a, 'VALIDATED');
    a = transition(a, 'APPROVED_FOR_USE');
    expect(a.state).toBe('APPROVED_FOR_USE');
    expect(isDeliverableState(a.state)).toBe(true);
  });

  it('only APPROVED_FOR_USE and REVIEWED_REUSABLE are deliverable to a child', () => {
    expect(isDeliverableState('APPROVED_FOR_USE')).toBe(true);
    expect(isDeliverableState('REVIEWED_REUSABLE')).toBe(true);
    for (const s of ['GENERATED', 'VALIDATION_PENDING', 'VALIDATED', 'QUARANTINED'] as const) {
      expect(isDeliverableState(s)).toBe(false);
    }
  });

  it('forbids skipping validation (GENERATED -> APPROVED_FOR_USE)', () => {
    try {
      transition(asset({ state: 'GENERATED' }), 'APPROVED_FOR_USE');
      throw new Error('expected POLICY_BLOCKED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });

  it('QUARANTINED is terminal — an asset is never revived in place', () => {
    expect(canTransition('QUARANTINED', 'VALIDATED')).toBe(false);
    expect(canTransition('QUARANTINED', 'APPROVED_FOR_USE')).toBe(false);
  });

  it('any pre-delivery state can fail-close to QUARANTINED', () => {
    for (const s of ['GENERATED', 'VALIDATION_PENDING', 'VALIDATED', 'APPROVED_FOR_USE'] as const) {
      expect(canTransition(s, 'QUARANTINED')).toBe(true);
    }
  });

  it('supports the controlled human-authored reference path', () => {
    let a = asset({ provenance: 'human_authored', state: 'HUMAN_AUTHORED' });
    a = transition(a, 'REVIEWED');
    a = transition(a, 'APPROVED_FOR_USE');
    expect(a.state).toBe('APPROVED_FOR_USE');
  });
});
