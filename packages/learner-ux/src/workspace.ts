import { MIN_TRUSTED_RECOGNITION } from '@potenova/learner-state';

/**
 * Math manipulatives / whiteboard workspace model (WP-08; AI Learning §6).
 *
 * A pure state model of the learner's workspace — manipulatives and whiteboard
 * steps the UI renders. Handwriting/workspace steps support reasoning evidence
 * ONLY to the extent they are recognized confidently; low-confidence steps are
 * kept for display but are not offered as reasoning evidence (shares the WP-03
 * trust floor).
 */

export const MANIPULATIVES = [
  'area-model',
  'number-line',
  'base-ten-blocks',
  'fraction-bars',
  'whiteboard',
] as const;
export type Manipulative = (typeof MANIPULATIVES)[number];

export interface WorkspaceStep {
  readonly stepId: string;
  readonly manipulative: Manipulative;
  /** Recognition certainty 0..1 for handwriting/gesture capture. */
  readonly recognitionConfidence: number;
}

export interface WorkspaceState {
  readonly learnerAlias: string;
  readonly skillId: string;
  readonly steps: readonly WorkspaceStep[];
}

export function createWorkspace(learnerAlias: string, skillId: string): WorkspaceState {
  return { learnerAlias, skillId, steps: [] };
}

export function addStep(state: WorkspaceState, step: WorkspaceStep): WorkspaceState {
  return { ...state, steps: [...state.steps, step] };
}

/** Steps confident enough to count as reasoning evidence (AI Learning §6). */
export function reasoningEvidenceSteps(state: WorkspaceState): WorkspaceStep[] {
  return state.steps.filter((s) => s.recognitionConfidence >= MIN_TRUSTED_RECOGNITION);
}
