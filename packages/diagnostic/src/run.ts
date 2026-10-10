import { DomainError } from '@potenova/contracts';

/**
 * DiagnosticRun lifecycle (Architecture §3.2; DIA-001/010; AT-05/06/07).
 *
 *   CREATED -> ACTIVE -> SUFFICIENT | PARTIAL | INTERRUPTED -> REVIEWED -> CLOSED
 *
 * - Confidence-based stop creates SUFFICIENT; a fatigue/age ceiling creates
 *   PARTIAL with explicit unknowns (never a failure label, DIA-011).
 * - INTERRUPTED resumes with the authorized learner/session — no penalty, no
 *   evidence duplication.
 * - A fresh diagnostic (AT-06/DIA-010) is a NEW, separately versioned run; it
 *   never deletes or mutates prior immutable evidence.
 */

export const DIAGNOSTIC_RUN_STATES = [
  'CREATED',
  'ACTIVE',
  'SUFFICIENT',
  'PARTIAL',
  'INTERRUPTED',
  'REVIEWED',
  'CLOSED',
] as const;
export type DiagnosticRunState = (typeof DIAGNOSTIC_RUN_STATES)[number];

export type Subject = 'math' | 'english';

export interface DiagnosticRun {
  readonly runId: string;
  /** Monotonic version for this learner+subject baseline (DIA-010). */
  readonly runVersion: number;
  readonly learnerAlias: string;
  readonly subject: Subject;
  readonly curriculumReleaseId: string;
  readonly targetSkillIds: readonly string[];
  readonly state: DiagnosticRunState;
  readonly probesUsed: number;
}

const TRANSITIONS: Readonly<Record<DiagnosticRunState, readonly DiagnosticRunState[]>> = {
  CREATED: ['ACTIVE'],
  ACTIVE: ['SUFFICIENT', 'PARTIAL', 'INTERRUPTED'],
  INTERRUPTED: ['ACTIVE'], // authorized resume
  SUFFICIENT: ['REVIEWED'],
  PARTIAL: ['REVIEWED'],
  REVIEWED: ['CLOSED'],
  CLOSED: [],
};

export function canTransitionRun(from: DiagnosticRunState, to: DiagnosticRunState): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * @throws DomainError POLICY_BLOCKED — illegal lifecycle transition.
 */
export function transitionRun(run: DiagnosticRun, to: DiagnosticRunState): DiagnosticRun {
  if (!canTransitionRun(run.state, to)) {
    throw new DomainError(
      'POLICY_BLOCKED',
      `illegal diagnostic run transition ${run.state} -> ${to}`,
    );
  }
  return { ...run, state: to };
}

export interface NewRunInput {
  readonly runId: string;
  readonly learnerAlias: string;
  readonly subject: Subject;
  readonly curriculumReleaseId: string;
  readonly targetSkillIds: readonly string[];
}

export function createRun(input: NewRunInput): DiagnosticRun {
  return { ...input, runVersion: 1, state: 'CREATED', probesUsed: 0 };
}

/**
 * Start a fresh baseline from a prior run (AT-06/DIA-010). Returns a NEW run with
 * an incremented version; the prior run object is returned untouched. This layer
 * never touches the learner's immutable evidence — a repeat baseline is purely
 * additive and separately versioned.
 */
export function startFreshDiagnostic(prior: DiagnosticRun, newRunId: string): DiagnosticRun {
  return {
    runId: newRunId,
    runVersion: prior.runVersion + 1,
    learnerAlias: prior.learnerAlias,
    subject: prior.subject,
    curriculumReleaseId: prior.curriculumReleaseId,
    targetSkillIds: prior.targetSkillIds,
    state: 'CREATED',
    probesUsed: 0,
  };
}
