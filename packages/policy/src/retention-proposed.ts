import { retentionPolicyFrom, type RetentionPolicy } from './retention';

/**
 * The PROPOSED retention schedule (ER-07), from the virtual privacy review —
 * `claude/Privacy_Decisions_ER-07_ER-10_PRIV-005_proposed.md`. Minimized for
 * children; the only long period is billing (CRA financial-records floor, parent
 * data, not child data).
 *
 * Every entry is `approved: false`, so the policy is CONFIGURED but UNAPPROVED:
 * it reads under `evaluateRetention` for non-prod work, but `assertRetentionReady`
 * fails closed in prod and `requireApproved` rejects it. It is literally one
 * sign-off from live — a licensed counsel confirms the numbers and these flip to
 * `approved: true`. Nothing here is a final decision.
 */

export const PROPOSED_RETENTION_SET_BY =
  'virtual-privacy-review (PROPOSED — pending licensed Ontario counsel)';

export function proposedRetentionPolicy(setAt?: string): RetentionPolicy {
  const base = { setBy: PROPOSED_RETENTION_SET_BY, setAt, approved: false } as const;
  return retentionPolicyFrom({
    learner_identity: {
      ...base,
      rule: { activeDays: 90, backupDays: 35, deletion: 'purge', basis: 'from_account_closure' },
    },
    diagnostic_responses: {
      ...base,
      rule: { activeDays: 90, backupDays: 35, deletion: 'purge', basis: 'from_account_closure' },
    },
    ai_prompts: {
      ...base,
      rule: { activeDays: 30, backupDays: 35, deletion: 'purge', basis: 'from_creation' },
    },
    learner_evidence: {
      ...base,
      rule: {
        activeDays: 90,
        backupDays: 35,
        deletion: 'anonymize',
        basis: 'from_account_closure',
      },
    },
    safety_incidents: {
      ...base,
      rule: { activeDays: 365, backupDays: 35, deletion: 'purge', basis: 'from_creation' },
    },
    support_tickets: {
      ...base,
      rule: { activeDays: 730, backupDays: 35, deletion: 'purge', basis: 'from_creation' },
    },
    parent_reports: {
      ...base,
      rule: { activeDays: 90, backupDays: 35, deletion: 'purge', basis: 'from_account_closure' },
    },
    analytics: {
      ...base,
      rule: { activeDays: 90, backupDays: 35, deletion: 'purge', basis: 'from_creation' },
    },
    billing: {
      // ~7 years — CRA / financial-records floor; parent data, not child data.
      ...base,
      rule: { activeDays: 2555, backupDays: 35, deletion: 'purge', basis: 'from_creation' },
    },
    security_audit: {
      ...base,
      rule: { activeDays: 730, backupDays: 35, deletion: 'purge', basis: 'from_creation' },
    },
    backup_dr: {
      ...base,
      rule: { activeDays: 35, backupDays: 35, deletion: 'purge', basis: 'from_creation' },
    },
  });
}
