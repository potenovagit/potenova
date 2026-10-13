import type { PlannerPolicy } from './policy';

/**
 * Stall detection (AT-08): consecutive non-progress attempts on one skill. A
 * correct answer resets the run. At or beyond `policy.stallAttempts` the coaching
 * strategy MUST change — the same task is never simply re-served.
 */
export interface StallStatus {
  /** Length of the trailing run of incorrect attempts. */
  readonly consecutiveWrong: number;
  readonly stalled: boolean;
}

/** `outcomes` are per-attempt correctness flags, ordered oldest → newest. */
export function stallStatus(outcomes: readonly boolean[], policy: PlannerPolicy): StallStatus {
  let consecutiveWrong = 0;
  for (let i = outcomes.length - 1; i >= 0; i--) {
    if (outcomes[i]) break;
    consecutiveWrong++;
  }
  return { consecutiveWrong, stalled: consecutiveWrong >= policy.stallAttempts };
}
