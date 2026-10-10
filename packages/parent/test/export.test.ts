import { describe, it, expect } from 'vitest';
import { authorizeExport, type ExportRequest } from '@potenova/parent';
import { isDomainError } from '@potenova/contracts';

const req = (over: Partial<ExportRequest> = {}): ExportRequest => ({
  guardianRole: 'owner',
  stepUpVerified: true,
  familyId: 'fam-1',
  requestedLearnerId: 'lnr-a',
  authorizedLearnerIds: ['lnr-a', 'lnr-b'],
  ...over,
});

describe('scoped progress export (PAR-013; AT-33)', () => {
  it('authorizes a single-learner export for a stepped-up owner', () => {
    const g = authorizeExport(req());
    expect(g).toEqual({ familyId: 'fam-1', learnerId: 'lnr-a', scope: 'single_learner' });
  });

  it('requires step-up re-verification', () => {
    try {
      authorizeExport(req({ stepUpVerified: false }));
      throw new Error('expected AUTH_REQUIRED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('AUTH_REQUIRED');
    }
  });

  it('a learning_viewer cannot export', () => {
    try {
      authorizeExport(req({ guardianRole: 'learning_viewer' }));
      throw new Error('expected FORBIDDEN_ROLE');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('FORBIDDEN_ROLE');
    }
  });

  it('AT-33: cannot export a learner outside the authorized scope (no sibling leak)', () => {
    try {
      authorizeExport(req({ requestedLearnerId: 'lnr-x' }));
      throw new Error('expected FORBIDDEN_ROLE');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('FORBIDDEN_ROLE');
    }
  });
});
