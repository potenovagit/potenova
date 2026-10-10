import { describe, it, expect } from 'vitest';
import {
  planSession,
  readySession,
  activateSession,
  endEarly,
  haltForIncident,
  resumeFromIncident,
  canTransitionSession,
  type TutoringSession,
  type SessionStartGate,
} from '@potenova/planner';
import { isDomainError } from '@potenova/contracts';

const planned = (): TutoringSession =>
  planSession({ sessionId: 'sess-1', learnerAlias: 'lnr-alias', subject: 'math' });

const okGate: SessionStartGate = { consentOk: true, entitlementActive: true, withinAgeCap: true };

describe('TutoringSession lifecycle (§3.3, AT-26)', () => {
  it('gates PLANNED -> READY -> ACTIVE with consent, entitlement and age cap', () => {
    const active = activateSession(readySession(planned(), okGate));
    expect(active.state).toBe('ACTIVE');
  });

  it('refuses to ready a session without consent / entitlement / within age cap', () => {
    const cases: Array<[SessionStartGate, string]> = [
      [{ ...okGate, consentOk: false }, 'CONSENT_REQUIRED'],
      [{ ...okGate, entitlementActive: false }, 'ENTITLEMENT_INACTIVE'],
      [{ ...okGate, withinAgeCap: false }, 'POLICY_BLOCKED'],
    ];
    for (const [gate, code] of cases) {
      try {
        readySession(planned(), gate);
        throw new Error('expected ' + code);
      } catch (e) {
        expect(isDomainError(e) && e.code).toBe(code);
      }
    }
  });

  it('AT-26: a child stop is neutral ENDED_EARLY with no mastery change', () => {
    const active = activateSession(readySession(planned(), okGate));
    const { session, masteryChanged } = endEarly(active);
    expect(session.state).toBe('ENDED_EARLY');
    expect(masteryChanged).toBe(false);
  });

  it('INCIDENT_HALTED resumes only with incident authorization (no tutor bypass)', () => {
    const active = activateSession(readySession(planned(), okGate));
    const halted = haltForIncident(active);
    expect(halted.state).toBe('INCIDENT_HALTED');
    try {
      resumeFromIncident(halted, { incidentAuthorized: false });
      throw new Error('expected FORBIDDEN_ROLE');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('FORBIDDEN_ROLE');
    }
    expect(resumeFromIncident(halted, { incidentAuthorized: true }).state).toBe(
      'LIMITED_SAFE_MODE',
    );
  });

  it('terminal states do not transition further', () => {
    expect(canTransitionSession('COMPLETED', 'ACTIVE')).toBe(false);
    expect(canTransitionSession('ENDED_EARLY', 'ACTIVE')).toBe(false);
  });
});
