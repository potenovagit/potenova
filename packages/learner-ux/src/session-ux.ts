import { DomainError } from '@potenova/contracts';
import { activateSession, type TutoringSession } from '@potenova/planner';

/**
 * Device resume + submission idempotency (WP-08; AT-04/27).
 *
 * - Resume is at-most-once: a resume ticket is consumed when used; a replayed,
 *   expired or unauthorized ticket is denied (a stolen token never resumes).
 * - A submission carries a client submission id so a retry after a disconnect
 *   produces AT-MOST-ONE evidence event (AT-27).
 */

export interface ResumeRequest {
  readonly ticketId: string;
  readonly issuedAtMs: number;
  readonly nowMs: number;
  /** Authorized learner/session binding verified upstream (identity/WP-01). */
  readonly authorized: boolean;
}

export type ResumeDecision =
  | { readonly kind: 'RESUME' }
  | { readonly kind: 'DENY'; readonly reason: 'UNAUTHORIZED' | 'EXPIRED' | 'ALREADY_USED' };

export function decideResume(
  req: ResumeRequest,
  consumedTicketIds: ReadonlySet<string>,
  ttlMs: number,
): ResumeDecision {
  if (!req.authorized) return { kind: 'DENY', reason: 'UNAUTHORIZED' };
  if (req.nowMs - req.issuedAtMs > ttlMs) return { kind: 'DENY', reason: 'EXPIRED' };
  if (consumedTicketIds.has(req.ticketId)) return { kind: 'DENY', reason: 'ALREADY_USED' };
  return { kind: 'RESUME' };
}

/**
 * Resume a READY/PAUSED tutoring session exactly once. Consumes the ticket and
 * activates the WP-07 session; denies (and leaves the session untouched) otherwise.
 *
 * @throws DomainError FORBIDDEN_ROLE | STALE_VERSION — denied resume.
 */
export function resumeSession(
  session: TutoringSession,
  req: ResumeRequest,
  consumedTicketIds: Set<string>,
  ttlMs: number,
): TutoringSession {
  const decision = decideResume(req, consumedTicketIds, ttlMs);
  if (decision.kind === 'DENY') {
    if (decision.reason === 'UNAUTHORIZED') {
      throw new DomainError('FORBIDDEN_ROLE', 'resume denied: unauthorized ticket');
    }
    throw new DomainError('STALE_VERSION', `resume denied: ${decision.reason}`);
  }
  consumedTicketIds.add(req.ticketId);
  return activateSession(session);
}

/**
 * At-most-once submission ledger (AT-27). A retry with the same client submission
 * id is reported as a duplicate and NOT accepted again — so a mid-submission
 * disconnect yields at most one evidence event.
 */
export class SubmissionLedger {
  readonly #seen = new Set<string>();

  submit(clientSubmissionId: string): { readonly accepted: boolean; readonly duplicate: boolean } {
    if (this.#seen.has(clientSubmissionId)) return { accepted: false, duplicate: true };
    this.#seen.add(clientSubmissionId);
    return { accepted: true, duplicate: false };
  }

  count(): number {
    return this.#seen.size;
  }
}
