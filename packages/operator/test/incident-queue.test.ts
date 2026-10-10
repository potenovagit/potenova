import { describe, it, expect } from 'vitest';
import { openIncident, containIncident, attachRca, closeIncident } from '@potenova/operator';
import { isDomainError } from '@potenova/contracts';

describe('unified incident management (OPS-004/008; SAFE-013)', () => {
  it('SAFE-013: a child-safety incident cannot close without RCA + regression case', () => {
    let i = openIncident({
      incidentId: 'inc-1',
      stream: 'child_safety',
      severity: 'sev1',
      owner: 'safety-lead',
    });
    i = containIncident(i);
    try {
      closeIncident(i);
      throw new Error('expected REVIEW_REQUIRED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('REVIEW_REQUIRED');
    }
    i = attachRca(i, 'RC-0007-asset-x');
    expect(closeIncident(i).state).toBe('CLOSED');
  });

  it('a technical incident can close once contained, no regression required', () => {
    let i = openIncident({
      incidentId: 'inc-2',
      stream: 'technical',
      severity: 'sev3',
      owner: 'oncall',
    });
    i = containIncident(i);
    expect(closeIncident(i).state).toBe('CLOSED');
  });

  it('cannot close an incident that is still OPEN', () => {
    const i = openIncident({
      incidentId: 'inc-3',
      stream: 'technical',
      severity: 'sev4',
      owner: 'oncall',
    });
    try {
      closeIncident(i);
      throw new Error('expected CONFLICT');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('CONFLICT');
    }
  });
});
