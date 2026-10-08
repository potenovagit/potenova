import { type Purpose, DomainError } from '@potenova/contracts';

/**
 * Consent fence.
 *
 * LOCKED invariant (PRIV-004; ConsentGrant state machine 3.6; TM-46;
 * AT-01/AT-34; C-02): purpose-based processing cannot begin before a matching
 * ConsentGrant is GIVEN, and must stop immediately when the grant is REVOKED
 * (subject only to narrow documented exceptions, e.g. deletion itself).
 */

export type ConsentState = 'PROPOSED' | 'GIVEN' | 'REVOKED' | 'SUPERSEDED' | 'EXPIRED';

export interface ConsentGrant {
  readonly purpose: Purpose;
  readonly state: ConsentState;
  readonly noticeVersion: string;
}

/** Purposes that remain permitted even without an active grant (narrow set). */
const ALWAYS_PERMITTED: ReadonlySet<Purpose> = new Set<Purpose>(['deletion']);

/**
 * Assert that processing for `purpose` is permitted given the current grants.
 *
 * @throws DomainError CONSENT_REQUIRED — no GIVEN grant covering the purpose
 */
export function assertProcessingAllowed(purpose: Purpose, grants: readonly ConsentGrant[]): void {
  if (ALWAYS_PERMITTED.has(purpose)) return;
  const active = grants.some((g) => g.purpose === purpose && g.state === 'GIVEN');
  if (!active) {
    throw new DomainError('CONSENT_REQUIRED', 'no active consent for this purpose');
  }
}
