import { describe, it, expect } from 'vitest';
import { routeModel, type ModelRegistryEntry, type RouteRequest } from '@potenova/domain-core';
import { isDomainError } from '@potenova/contracts';

const approved: ModelRegistryEntry = {
  modelId: 'tutor-llm-approved',
  status: 'APPROVED',
  allowedRegions: ['ca-central', 'ca-east'],
  ageBands: ['6-8', '9-11'],
  subjects: ['math', 'english'],
  capabilities: ['generate_instruction', 'validate_content'],
  trainingDisabled: true,
};

const req: RouteRequest = {
  modelId: 'tutor-llm-approved',
  processingRegion: 'ca-central',
  ageBand: '9-11',
  subject: 'math',
  capability: 'generate_instruction',
  childContext: true,
};

describe('AI gateway routing policy (AI-002/003/004, TM-21/25, AT-37/55)', () => {
  it('routes an approved, in-region, in-envelope, training-disabled model', () => {
    const d = routeModel(approved, req);
    expect(d.reason).toBe('APPROVED_ROUTE');
    expect(d.processingRegion).toBe('ca-central');
  });

  it('refuses a non-Canadian processing region (fail-closed residency)', () => {
    const d = () => routeModel(approved, { ...req, processingRegion: 'us-east-1' });
    expect(() => d()).toThrowError();
    try {
      d();
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('REGION_DISALLOWED');
    }
  });

  it('refuses an unapproved/candidate model (AT-37: no prod child data to candidates)', () => {
    try {
      routeModel({ ...approved, status: 'SYNTHETIC_TESTING' }, req);
      throw new Error('expected POLICY_BLOCKED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });

  it('refuses a request outside the approved age/subject/capability envelope', () => {
    for (const bad of [
      { ...req, ageBand: '15-17' },
      { ...req, subject: 'science' },
      { ...req, capability: 'free_chat' },
    ]) {
      try {
        routeModel(approved, bad);
        throw new Error('expected POLICY_BLOCKED');
      } catch (e) {
        expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
      }
    }
  });

  it('refuses child-context routing when provider training is not disabled (PRIV-003/TM-20)', () => {
    try {
      routeModel({ ...approved, trainingDisabled: false }, req);
      throw new Error('expected POLICY_BLOCKED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });
});
