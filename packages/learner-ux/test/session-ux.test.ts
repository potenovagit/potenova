import { describe, it, expect } from 'vitest';
import {
  decideResume,
  resumeSession,
  SubmissionLedger,
  type ResumeRequest,
} from '@potenova/learner-ux';
import { planSession, readySession, type TutoringSession } from '@potenova/planner';
import { isDomainError } from '@potenova/contracts';

const TTL = 60_000;
const req = (over: Partial<ResumeRequest> = {}): ResumeRequest => ({
  ticketId: 't-1',
  issuedAtMs: 1000,
  nowMs: 1500,
  authorized: true,
  ...over,
});

const readySess = (): TutoringSession =>
  readySession(planSession({ sessionId: 's1', learnerAlias: 'lnr', subject: 'math' }), {
    consentOk: true,
    entitlementActive: true,
    withinAgeCap: true,
  });

describe('device resume (AT-04)', () => {
  it('resumes once, then denies a replay of the same ticket', () => {
    const consumed = new Set<string>();
    const first = resumeSession(readySess(), req(), consumed, TTL);
    expect(first.state).toBe('ACTIVE');
    try {
      resumeSession(readySess(), req(), consumed, TTL);
      throw new Error('expected denial');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('STALE_VERSION');
    }
  });

  it('denies an unauthorized (stolen) ticket', () => {
    expect(decideResume(req({ authorized: false }), new Set(), TTL)).toEqual({
      kind: 'DENY',
      reason: 'UNAUTHORIZED',
    });
  });

  it('denies an expired ticket', () => {
    expect(decideResume(req({ nowMs: 1000 + TTL + 1 }), new Set(), TTL).kind).toBe('DENY');
  });
});

describe('submission idempotency (AT-27)', () => {
  it('a retried submission produces at most one accepted event', () => {
    const ledger = new SubmissionLedger();
    expect(ledger.submit('c-1')).toEqual({ accepted: true, duplicate: false });
    expect(ledger.submit('c-1')).toEqual({ accepted: false, duplicate: true });
    expect(ledger.count()).toBe(1);
  });
});
