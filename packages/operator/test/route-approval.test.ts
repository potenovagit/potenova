import { describe, it, expect } from 'vitest';
import {
  approveModelRoute,
  assertNoChildInferenceBypass,
  hasApprovedFailover,
} from '@potenova/operator';
import { ModelRegistry } from '@potenova/ai-gateway';
import type { ModelRegistryEntry } from '@potenova/domain-core';
import { isDomainError } from '@potenova/contracts';

const entry = (id: string, over: Partial<ModelRegistryEntry> = {}): ModelRegistryEntry => ({
  modelId: id,
  status: 'APPROVED',
  allowedRegions: ['ca-central'],
  ageBands: ['junior'],
  subjects: ['math'],
  capabilities: ['generate_instruction'],
  trainingDisabled: true,
  ...over,
});

const need = {
  region: 'ca-central',
  ageBand: 'junior',
  subject: 'math',
  capability: 'generate_instruction',
};

describe('model/route approvals via central registry (OPS-016; AT-37/38)', () => {
  it('AT-37: an unapproved candidate cannot receive production child inference (no shadow)', () => {
    const reg = new ModelRegistry();
    reg.register(entry('cand', { status: 'SYNTHETIC_TESTING' }));
    try {
      assertNoChildInferenceBypass(reg, 'cand');
      throw new Error('expected POLICY_BLOCKED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });

  it('operator approval requires a privileged approver and then makes the model routable', () => {
    const reg = new ModelRegistry();
    reg.register(entry('cand', { status: 'EVALUATED' }));
    try {
      approveModelRoute(reg, 'cand', '');
      throw new Error('expected FORBIDDEN_ROLE');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('FORBIDDEN_ROLE');
    }
    approveModelRoute(reg, 'cand', 'gov-owner');
    expect(() => assertNoChildInferenceBypass(reg, 'cand')).not.toThrow();
  });

  it('AT-38: failover only finds another APPROVED in-region model', () => {
    const reg = new ModelRegistry();
    reg.register(entry('primary'));
    reg.register(entry('backup'));
    reg.register(entry('candidate', { status: 'SYNTHETIC_TESTING' }));
    expect(hasApprovedFailover(reg, need, 'primary')).toBe(true); // backup qualifies
    reg.setStatus('backup', 'DISABLED');
    expect(hasApprovedFailover(reg, need, 'primary')).toBe(false); // candidate never counts
  });
});
