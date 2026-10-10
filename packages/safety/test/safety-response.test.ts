import { describe, it, expect } from 'vitest';
import {
  secrecyRequestResponse,
  handleDisclosure,
  guardianRiskRouting,
  switchPersona,
} from '@potenova/safety';

describe('constrained safety responses (AT-22/23/36; SAFE-016)', () => {
  it('AT-22: never promises secrecy or claims to be human', () => {
    const r = secrecyRequestResponse();
    expect(r.promisesSecrecy).toBe(false);
    expect(r.claimsHuman).toBe(false);
    expect(r.action).toBe('SAFE_REDIRECT');
  });

  it('SAFE-016: off-topic redirects, a sensitive statement follows protocol', () => {
    expect(handleDisclosure('off_topic')).toBe('REDIRECT');
    expect(handleDisclosure('sensitive')).toBe('SAFETY_PROTOCOL');
  });

  it('AT-23: a household-implicating risk routes to review, no automatic parent alert', () => {
    const r = guardianRiskRouting({ householdImplication: true });
    expect(r.route).toBe('RESTRICTED_REVIEW');
    expect(r.notifyParentAutomatically).toBe(false);
  });

  it('AT-36: switching persona changes voice only — not safety rules or learner state', () => {
    const r = switchPersona('Explorer');
    expect(r.persona).toBe('Explorer');
    expect(r.safetyRulesChanged).toBe(false);
    expect(r.learnerStateChanged).toBe(false);
  });
});
