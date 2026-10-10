import { DomainError } from '@potenova/contracts';

/**
 * TutoringSession lifecycle (Architecture §3.3; AT-26/27).
 *
 *   PLANNED -> READY -> ACTIVE -> [PAUSED | LIMITED_SAFE_MODE]
 *           -> COMPLETED | ENDED_EARLY | EXPIRED | INCIDENT_HALTED
 *
 * LOCKED invariants:
 *  - Never ACTIVE without consent AND entitlement, and never beyond the age/session
 *    ceiling (gated in startSession).
 *  - A child may stop at any time: ENDED_EARLY is neutral — no mastery loss, no
 *    shaming (AT-26).
 *  - INCIDENT_HALTED resumes only through explicit incident authorization — no
 *    tutor bypass.
 *  - PAUSED/EXPIRED are neutral to learning evidence.
 */

export const SESSION_STATES = [
  'PLANNED',
  'READY',
  'ACTIVE',
  'PAUSED',
  'LIMITED_SAFE_MODE',
  'COMPLETED',
  'ENDED_EARLY',
  'EXPIRED',
  'INCIDENT_HALTED',
] as const;
export type SessionState = (typeof SESSION_STATES)[number];

export interface TutoringSession {
  readonly sessionId: string;
  readonly learnerAlias: string;
  readonly subject: 'math' | 'english';
  readonly state: SessionState;
}

const TRANSITIONS: Readonly<Record<SessionState, readonly SessionState[]>> = {
  PLANNED: ['READY'],
  READY: ['ACTIVE', 'EXPIRED'],
  ACTIVE: ['PAUSED', 'LIMITED_SAFE_MODE', 'COMPLETED', 'ENDED_EARLY', 'EXPIRED', 'INCIDENT_HALTED'],
  PAUSED: ['ACTIVE', 'ENDED_EARLY', 'EXPIRED'],
  LIMITED_SAFE_MODE: ['ACTIVE', 'COMPLETED', 'ENDED_EARLY', 'INCIDENT_HALTED'],
  INCIDENT_HALTED: ['LIMITED_SAFE_MODE'], // only via resumeFromIncident (authorized)
  COMPLETED: [],
  ENDED_EARLY: [],
  EXPIRED: [],
};

export function canTransitionSession(from: SessionState, to: SessionState): boolean {
  return TRANSITIONS[from].includes(to);
}

function move(session: TutoringSession, to: SessionState): TutoringSession {
  if (!canTransitionSession(session.state, to)) {
    throw new DomainError('POLICY_BLOCKED', `illegal session transition ${session.state} -> ${to}`);
  }
  return { ...session, state: to };
}

export interface SessionStartGate {
  readonly consentOk: boolean;
  readonly entitlementActive: boolean;
  /** Within the age/session ceiling (ER-09, computed upstream). */
  readonly withinAgeCap: boolean;
}

export interface NewSessionInput {
  readonly sessionId: string;
  readonly learnerAlias: string;
  readonly subject: 'math' | 'english';
}

export function planSession(input: NewSessionInput): TutoringSession {
  return { ...input, state: 'PLANNED' };
}

/**
 * Gate PLANNED -> READY. Enforces the non-negotiable preconditions for any
 * child-facing tutoring.
 *
 * @throws DomainError CONSENT_REQUIRED | ENTITLEMENT_INACTIVE | POLICY_BLOCKED
 */
export function readySession(session: TutoringSession, gate: SessionStartGate): TutoringSession {
  if (!gate.consentOk)
    throw new DomainError('CONSENT_REQUIRED', 'tutoring requires active consent');
  if (!gate.entitlementActive) {
    throw new DomainError('ENTITLEMENT_INACTIVE', 'tutoring requires an active entitlement');
  }
  if (!gate.withinAgeCap) {
    throw new DomainError('POLICY_BLOCKED', 'session would exceed the age/session ceiling');
  }
  return move(session, 'READY');
}

export function activateSession(session: TutoringSession): TutoringSession {
  return move(session, 'ACTIVE');
}

/** AT-26: a child-initiated stop is neutral — no mastery change, no shaming. */
export function endEarly(session: TutoringSession): {
  session: TutoringSession;
  masteryChanged: false;
} {
  return { session: move(session, 'ENDED_EARLY'), masteryChanged: false };
}

export function pause(session: TutoringSession): TutoringSession {
  return move(session, 'PAUSED');
}

export function enterLimitedSafeMode(session: TutoringSession): TutoringSession {
  return move(session, 'LIMITED_SAFE_MODE');
}

export function haltForIncident(session: TutoringSession): TutoringSession {
  return move(session, 'INCIDENT_HALTED');
}

/**
 * Resume a halted session — ONLY with explicit incident authorization. A tutor
 * turn can never clear an incident halt on its own.
 *
 * @throws DomainError FORBIDDEN_ROLE — not incident-authorized.
 */
export function resumeFromIncident(
  session: TutoringSession,
  opts: { readonly incidentAuthorized: boolean },
): TutoringSession {
  if (!opts.incidentAuthorized) {
    throw new DomainError('FORBIDDEN_ROLE', 'incident resumption requires incident authorization');
  }
  return move(session, 'LIMITED_SAFE_MODE');
}
