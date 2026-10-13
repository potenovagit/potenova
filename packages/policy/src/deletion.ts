import { DomainError } from '@potenova/contracts';

/**
 * Deletion-propagation verification (PRIV-005; NFR-17; TM-48).
 *
 * A data-subject erasure (account closure, subject request, or retention expiry)
 * must reach EVERY store the subject's data lives in — first-party database, the
 * AI provider, analytics, and backups — not just the primary store. This module
 * makes "deleted" mean "verified deleted across every required target": an
 * erasure is complete only when each required target reports a terminal success,
 * and fails closed otherwise. The ErasureRecord is the accountability artifact.
 *
 * Backups are handled as a TOMBSTONE, not an immediate purge (NFR-17): a restored
 * backup must re-apply the deletion. `tombstoned` counts as success for that
 * target. The security audit log is intentionally NOT an erasure target — it is
 * retained for accountability and holds reason codes, never raw child content
 * (SEC-004/017).
 */

export type DeletionTargetKind = 'first_party_store' | 'provider' | 'analytics' | 'backups';

export interface DeletionTarget {
  /** Stable id, e.g. 'first_party_store', 'provider:azure_openai', 'backups'. */
  readonly id: string;
  readonly kind: DeletionTargetKind;
  readonly required: boolean;
}

export type DeletionStatus = 'pending' | 'completed' | 'tombstoned' | 'not_applicable' | 'failed';

/** Terminal states that count as a successful erasure for a target. */
const SUCCESS: readonly DeletionStatus[] = ['completed', 'tombstoned', 'not_applicable'];

export interface DeletionTargetOutcome {
  readonly target: DeletionTarget;
  readonly status: DeletionStatus;
  readonly at?: string;
  readonly note?: string;
}

export type ErasureReason = 'account_closure' | 'subject_request' | 'retention_expiry';

export interface ErasureScope {
  readonly subjectType: 'learner' | 'family';
  readonly subjectId: string;
  readonly reason: ErasureReason;
  readonly requestedAt: string;
}

export interface ErasureRecord {
  readonly scope: ErasureScope;
  readonly outcomes: readonly DeletionTargetOutcome[];
}

/**
 * The stores a child-data erasure must reach. Provider is required even though a
 * modified-abuse-monitoring deployment stores nothing — it must still be attested
 * (`not_applicable`), never assumed.
 */
export const DEFAULT_ERASURE_TARGETS: readonly DeletionTarget[] = [
  { id: 'first_party_store', kind: 'first_party_store', required: true },
  { id: 'analytics', kind: 'analytics', required: true },
  { id: 'provider:azure_openai', kind: 'provider', required: true },
  { id: 'backups', kind: 'backups', required: true },
];

export function planErasure(
  scope: ErasureScope,
  targets: readonly DeletionTarget[] = DEFAULT_ERASURE_TARGETS,
): ErasureRecord {
  return { scope, outcomes: targets.map((target) => ({ target, status: 'pending' as const })) };
}

/** Record a target's outcome, returning an updated record (immutable). */
export function recordTargetOutcome(
  record: ErasureRecord,
  targetId: string,
  status: DeletionStatus,
  opts: { at?: string; note?: string } = {},
): ErasureRecord {
  let found = false;
  const outcomes = record.outcomes.map((o) => {
    if (o.target.id !== targetId) return o;
    found = true;
    return {
      target: o.target,
      status,
      at: opts.at ?? new Date().toISOString(),
      note: opts.note,
    };
  });
  if (!found) {
    throw new DomainError('NOT_FOUND', `erasure target not in record: ${targetId}`);
  }
  return { ...record, outcomes };
}

export interface ErasureVerification {
  readonly complete: boolean;
  /** Target ids that are required but not yet in a terminal-success state. */
  readonly outstanding: readonly string[];
}

/**
 * Verify an erasure is complete. Fail-closed: any required target that is missing
 * from the record, or not in a success state, is outstanding. A required target
 * the plan forgot to include is still reported outstanding, so a missed store can
 * never read as "done".
 */
export function verifyErasure(
  record: ErasureRecord,
  expectedRequiredIds: readonly string[] = DEFAULT_ERASURE_TARGETS.filter((t) => t.required).map(
    (t) => t.id,
  ),
): ErasureVerification {
  const byId = new Map(record.outcomes.map((o) => [o.target.id, o]));
  const outstanding = new Set<string>();

  for (const id of expectedRequiredIds) {
    const o = byId.get(id);
    if (!o || !SUCCESS.includes(o.status)) outstanding.add(id);
  }
  // Any required target present in the record but not successful (beyond the
  // expected set) is also outstanding.
  for (const o of record.outcomes) {
    if (o.target.required && !SUCCESS.includes(o.status)) outstanding.add(o.target.id);
  }

  return { complete: outstanding.size === 0, outstanding: [...outstanding] };
}

/**
 * Assert an erasure is fully propagated before reporting it done to the subject.
 *
 * @throws DomainError POLICY_BLOCKED — any required target is unverified.
 */
export function assertErasureComplete(
  record: ErasureRecord,
  expectedRequiredIds?: readonly string[],
): void {
  const v = verifyErasure(record, expectedRequiredIds);
  if (!v.complete) {
    throw new DomainError(
      'POLICY_BLOCKED',
      `erasure incomplete — outstanding targets: [${v.outstanding.join(', ')}]`,
    );
  }
}
