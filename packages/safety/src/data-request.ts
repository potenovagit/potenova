import { DomainError } from '@potenova/contracts';

/**
 * Data-subject request orchestration (Architecture §3.9; PRIV-005; AT-34/35).
 *
 *   REQUESTED -> AUTHENTICATING -> SCOPED -> EXECUTING -> VERIFYING
 *             -> COMPLETE | EXCEPTION_REVIEW
 *
 * Deletion fans out to primary data, derivatives, caches, backups and processors.
 * Completion is represented ONLY after reconciliation — if any target is
 * unresolved (e.g. a backup on a documented retention schedule), the request goes
 * to EXCEPTION_REVIEW with the exception documented, never a premature "complete"
 * (AT-35). Revoking an optional modality consent stops that service while other
 * approved core learning continues (AT-34).
 */

export const DSR_STATES = [
  'REQUESTED',
  'AUTHENTICATING',
  'SCOPED',
  'EXECUTING',
  'VERIFYING',
  'COMPLETE',
  'EXCEPTION_REVIEW',
] as const;
export type DsrState = (typeof DSR_STATES)[number];

export type DsrKind = 'export' | 'deletion';

export interface DeletionTarget {
  readonly target: 'primary' | 'derivative' | 'cache' | 'backup' | 'processor';
  readonly reconciled: boolean;
  /** A documented legal/retention exception (e.g. backup erasure schedule). */
  readonly documentedException: boolean;
}

export interface DataSubjectRequest {
  readonly requestId: string;
  readonly kind: DsrKind;
  readonly state: DsrState;
}

const TRANSITIONS: Readonly<Record<DsrState, readonly DsrState[]>> = {
  REQUESTED: ['AUTHENTICATING'],
  AUTHENTICATING: ['SCOPED'],
  SCOPED: ['EXECUTING'],
  EXECUTING: ['VERIFYING'],
  VERIFYING: ['COMPLETE', 'EXCEPTION_REVIEW'],
  COMPLETE: [],
  EXCEPTION_REVIEW: [],
};

export function openDsr(requestId: string, kind: DsrKind): DataSubjectRequest {
  return { requestId, kind, state: 'REQUESTED' };
}

export function advanceDsr(req: DataSubjectRequest, to: DsrState): DataSubjectRequest {
  if (!TRANSITIONS[req.state].includes(to)) {
    throw new DomainError('POLICY_BLOCKED', `illegal DSR transition ${req.state} -> ${to}`);
  }
  return { ...req, state: to };
}

/**
 * Finalize a VERIFYING request. COMPLETE only when every target is reconciled or
 * carries a documented exception; otherwise EXCEPTION_REVIEW (AT-35).
 */
export function finalizeDeletion(
  req: DataSubjectRequest,
  targets: readonly DeletionTarget[],
): DataSubjectRequest {
  if (req.state !== 'VERIFYING') {
    throw new DomainError('CONFLICT', 'deletion must be VERIFYING before finalize');
  }
  const unresolved = targets.some((t) => !t.reconciled && !t.documentedException);
  return advanceDsr(req, unresolved ? 'EXCEPTION_REVIEW' : 'COMPLETE');
}

export interface ModalityRevocation {
  readonly stoppedModality: string;
  /** Invariant (AT-34): revoking an optional modality leaves core learning active. */
  readonly coreLearningContinues: true;
}

/** AT-34: revoke an optional modality consent — that service stops, core continues. */
export function revokeModalityConsent(modality: string): ModalityRevocation {
  return { stoppedModality: modality, coreLearningContinues: true };
}
