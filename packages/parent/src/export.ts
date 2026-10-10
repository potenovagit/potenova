import { DomainError } from '@potenova/contracts';
import type { GuardianRole } from '@potenova/identity';

/**
 * Progress export under protected authorization (PAR-013; AT-33).
 *
 * Export requires a verified step-up and is scoped to a single authorized
 * learner within the family — it must never leak a sibling's data. Only the
 * account owner role may export (a learning_viewer cannot, per the role matrix).
 */

export interface ExportRequest {
  readonly guardianRole: GuardianRole;
  readonly stepUpVerified: boolean;
  readonly familyId: string;
  readonly requestedLearnerId: string;
  /** Learners this guardian is authorized to export within the family. */
  readonly authorizedLearnerIds: readonly string[];
}

export interface ExportGrant {
  readonly familyId: string;
  readonly learnerId: string;
  readonly scope: 'single_learner';
}

/**
 * Authorize a scoped export.
 *
 * @throws DomainError FORBIDDEN_ROLE  — a non-owner role, or a learner outside scope.
 * @throws DomainError AUTH_REQUIRED   — step-up not satisfied.
 */
export function authorizeExport(req: ExportRequest): ExportGrant {
  if (req.guardianRole !== 'owner') {
    throw new DomainError('FORBIDDEN_ROLE', 'only the account owner may export progress');
  }
  if (!req.stepUpVerified) {
    throw new DomainError('AUTH_REQUIRED', 'export requires step-up re-verification');
  }
  if (!req.authorizedLearnerIds.includes(req.requestedLearnerId)) {
    throw new DomainError('FORBIDDEN_ROLE', 'requested learner is outside the authorized scope');
  }
  return { familyId: req.familyId, learnerId: req.requestedLearnerId, scope: 'single_learner' };
}
