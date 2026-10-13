import { DomainError } from '@potenova/contracts';
import { configured, pending, type PolicyValue } from './provenance';

/**
 * Data-retention policy mechanism (ER-07 / NFR-17). Built now, valued later:
 * legal returns the retention schedule and you call `retentionPolicyFrom(...)`
 * to drop the numbers in. Until then every class is PENDING and fails closed —
 * the system may not process/persist that class's data in prod, and nothing
 * defaults to "keep forever."
 */

export type DataClass =
  | 'learner_identity'
  | 'diagnostic_responses'
  | 'ai_prompts'
  | 'learner_evidence'
  | 'safety_incidents'
  | 'support_tickets'
  | 'parent_reports'
  | 'analytics'
  | 'billing'
  | 'security_audit'
  | 'backup_dr';

export const DATA_CLASSES: readonly DataClass[] = [
  'learner_identity',
  'diagnostic_responses',
  'ai_prompts',
  'learner_evidence',
  'safety_incidents',
  'support_tickets',
  'parent_reports',
  'analytics',
  'billing',
  'security_audit',
  'backup_dr',
];

export type DeletionRule = 'purge' | 'tombstone' | 'anonymize';

/** What `activeDays` counts from — creation of the record, or account closure. */
export type RetentionBasis = 'from_creation' | 'from_account_closure';

export interface RetentionRule {
  /** Days kept in the active store before deletion is due (counted from `basis`). */
  readonly activeDays: number;
  /** Days kept in backups before purge (NFR-17 restored-backup tombstone). */
  readonly backupDays: number;
  readonly deletion: DeletionRule;
  /** When the active-retention clock starts. Defaults to 'from_creation'. */
  readonly basis?: RetentionBasis;
}

export type RetentionPolicy = Readonly<Record<DataClass, PolicyValue<RetentionRule>>>;

/** The starting state: every class pending ER-07. */
export function emptyRetentionPolicy(decisionId = 'ER-07'): RetentionPolicy {
  const out = {} as Record<DataClass, PolicyValue<RetentionRule>>;
  for (const dc of DATA_CLASSES) out[dc] = pending(decisionId, `retention for ${dc}`);
  return out;
}

/**
 * Build a policy from whatever legal has returned so far. Classes present become
 * CONFIGURED (approved if signed); the rest stay PENDING. This is the one call
 * you make when the schedule arrives.
 */
export function retentionPolicyFrom(
  entries: Partial<
    Record<DataClass, { rule: RetentionRule; setBy: string; setAt?: string; approved?: boolean }>
  >,
  decisionId = 'ER-07',
): RetentionPolicy {
  const out = {} as Record<DataClass, PolicyValue<RetentionRule>>;
  for (const dc of DATA_CLASSES) {
    const e = entries[dc];
    out[dc] = e
      ? configured(decisionId, e.rule, { setBy: e.setBy, setAt: e.setAt, approved: e.approved })
      : pending(decisionId, `retention for ${dc}`);
  }
  return out;
}

export type RetentionAction = 'retain' | 'due_for_deletion' | 'blocked_unconfigured';

export interface RetentionOutcome {
  readonly dataClass: DataClass;
  readonly action: RetentionAction;
  readonly deletion?: DeletionRule;
  /** Days past the active-retention limit (when due_for_deletion). */
  readonly overBy?: number;
}

/**
 * Decide what happens to a record of `dataClass` at `recordAgeDays`. Fail-closed:
 * an unconfigured (or, when requireApproved, unsigned) class yields
 * `blocked_unconfigured` — the caller must refuse to process/persist it in prod
 * rather than retain it indefinitely.
 */
export function evaluateRetention(
  policy: RetentionPolicy,
  dataClass: DataClass,
  recordAgeDays: number,
  opts: { requireApproved?: boolean } = {},
): RetentionOutcome {
  const v = policy[dataClass];
  const usable = v?.status === 'configured' && (!opts.requireApproved || v.approved);
  if (!usable || v.status !== 'configured') {
    return { dataClass, action: 'blocked_unconfigured' };
  }
  const rule = v.value;
  if (recordAgeDays >= rule.activeDays) {
    return {
      dataClass,
      action: 'due_for_deletion',
      deletion: rule.deletion,
      overBy: recordAgeDays - rule.activeDays,
    };
  }
  return { dataClass, action: 'retain' };
}

export interface RetentionReadiness {
  readonly ready: boolean;
  readonly unconfigured: readonly DataClass[];
  readonly unapproved: readonly DataClass[];
}

/** Which in-use classes still lack a configured / approved rule. */
export function checkRetentionReadiness(
  policy: RetentionPolicy,
  classesInUse: readonly DataClass[],
): RetentionReadiness {
  const unconfigured = classesInUse.filter((dc) => policy[dc]?.status !== 'configured');
  const unapproved = classesInUse.filter((dc) => {
    const v = policy[dc];
    return v?.status === 'configured' && !v.approved;
  });
  return { ready: unconfigured.length === 0 && unapproved.length === 0, unconfigured, unapproved };
}

/**
 * Gate check. In prod, every in-use data class MUST have an approved retention
 * rule or this throws (no real child data without a signed schedule — ER-07).
 * In non-prod it returns the gaps as advisory rather than throwing.
 *
 * @throws DomainError POLICY_BLOCKED — prod with any unconfigured/unapproved class.
 */
export function assertRetentionReady(
  policy: RetentionPolicy,
  classesInUse: readonly DataClass[],
  isProd: boolean,
): RetentionReadiness {
  const r = checkRetentionReadiness(policy, classesInUse);
  if (isProd && !r.ready) {
    throw new DomainError(
      'POLICY_BLOCKED',
      `retention schedule incomplete (ER-07): unconfigured=[${r.unconfigured.join(',')}] unapproved=[${r.unapproved.join(',')}]`,
    );
  }
  return r;
}
