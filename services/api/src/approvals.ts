import { AGE_BANDS, type AgeBand } from '@potenova/identity';
import { DRAFT_MASTERY_POLICY, type MasteryPolicy } from '@potenova/learner-state';
import { usageCapsPolicyFrom, type UsageCaps, type UsageCapsPolicy } from '@potenova/policy';

/**
 * Approval-flip config path (governance: encode a reviewer's decision).
 *
 * Every EVIDENCE-REQUIRED policy ships fail-closed with a DRAFT, unapproved value
 * (see `G2_Mechanism_Status_Map.md`). When the accountable reviewer returns an
 * approved value, encoding it must be a CONFIG change — a signed value dropped in,
 * flipping that policy to `approved: true` — never a code change under pressure.
 *
 * This module turns a signed approvals config into approved policy values. Absent
 * an approval, the policy stays exactly as before (DRAFT in non-prod; empty/
 * fail-closed in prod). Approvals are supplied by the host (env `POTENOVA_APPROVALS`
 * as JSON, or injected for tests) — nothing here invents or self-signs a value.
 *
 * Scope: the two gates that stop a production session — mastery (ER-03) and usage
 * caps (ER-09). Escalation (ER-08) and retention (ER-07) follow the same shape and
 * are added here as their reviewers return values.
 */

export interface MasteryApproval {
  /** The reviewer's signed policy version (replaces the …-UNCALIBRATED DRAFT tag). */
  readonly version: string;
  readonly minUnaidedForIndependent?: number;
  readonly minRepresentationsForIndependent?: number;
  readonly retentionDelayMs?: number;
  readonly unaidedBands?: readonly string[];
}

export interface UsageCapsApproval {
  /** Who signed the caps (the child-safety expert). */
  readonly setBy: string;
  readonly bands: Partial<Record<AgeBand, UsageCaps>>;
}

export interface ApprovalsConfig {
  readonly mastery?: MasteryApproval;
  readonly usageCaps?: UsageCapsApproval;
}

/** The approved mastery policy from a signed approval, or the fail-closed DRAFT. */
export function masteryPolicyFrom(approval?: MasteryApproval): MasteryPolicy {
  if (!approval) return DRAFT_MASTERY_POLICY;
  return {
    policyVersion: approval.version,
    minUnaidedForIndependent:
      approval.minUnaidedForIndependent ?? DRAFT_MASTERY_POLICY.minUnaidedForIndependent,
    minRepresentationsForIndependent:
      approval.minRepresentationsForIndependent ??
      DRAFT_MASTERY_POLICY.minRepresentationsForIndependent,
    retentionDelayMs: approval.retentionDelayMs ?? DRAFT_MASTERY_POLICY.retentionDelayMs,
    unaidedBands: approval.unaidedBands ?? DRAFT_MASTERY_POLICY.unaidedBands,
    approved: true,
  };
}

/** Approved usage caps from a signed approval (approved bands configured; bands
 *  the reviewer omitted stay pending → fail closed), or undefined when no approval. */
export function usageCapsFrom(approval?: UsageCapsApproval): UsageCapsPolicy | undefined {
  if (!approval) return undefined;
  const entries: Partial<Record<AgeBand, { caps: UsageCaps; setBy: string; approved: boolean }>> =
    {};
  for (const b of AGE_BANDS) {
    const caps = approval.bands[b];
    if (caps) entries[b] = { caps, setBy: approval.setBy, approved: true };
  }
  return usageCapsPolicyFrom(entries);
}

/** Parse an approvals config from the environment (JSON). Invalid/absent → none. */
export function parseApprovals(env: NodeJS.ProcessEnv): ApprovalsConfig | undefined {
  const raw = env.POTENOVA_APPROVALS;
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as ApprovalsConfig) : undefined;
  } catch {
    return undefined;
  }
}
