import type { PlannerPolicy } from './policy';

/**
 * Teaching-strategy engine (AI Learning §5; AT-08/16/17).
 *
 * Strategy is distinct from representation/modality. When progress stalls, the
 * engine switches strategy/representation BEFORE simply repeating the same task
 * (AT-08) — repetition is never the stall response. A valid alternative solution
 * path is accepted on its merits (AT-17), and rapid low-latency guessing triggers
 * a reasoning probe rather than credit or punishment (AT-16).
 */

export const STRATEGIES = [
  'diagnostic_probe',
  'prerequisite_review',
  'concrete_manipulative',
  'representational_shift',
  'analogous_example',
  'socratic_question',
  'guided_practice',
  'productive_waiting',
  'misconception_counterexample',
  'transfer_challenge',
  'brief_break',
  'session_termination',
] as const;
export type Strategy = (typeof STRATEGIES)[number];

/** Preferred escalation order when a strategy stalls (switch, never repeat). */
const STALL_ESCALATION: readonly Strategy[] = [
  'representational_shift',
  'concrete_manipulative',
  'prerequisite_review',
  'misconception_counterexample',
  'analogous_example',
  'socratic_question',
  'brief_break',
];

export interface AttemptOutcome {
  readonly correct: boolean;
  /** True when it counted as progress (unaided/near-unaided success). */
  readonly progressed: boolean;
}

export type StrategyDecision =
  | { readonly kind: 'CONTINUE'; readonly strategy: Strategy }
  | { readonly kind: 'SWITCH'; readonly strategy: Strategy };

/**
 * Decide the next strategy given recent outcomes on the current one.
 * A run of non-progress at/over the policy's stall count forces a SWITCH to a
 * different strategy — never a repeat of the current one.
 */
export function nextStrategy(
  current: Strategy,
  recent: readonly AttemptOutcome[],
  policy: PlannerPolicy,
): StrategyDecision {
  let streak = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i]!.progressed) break;
    streak++;
  }
  if (streak < policy.stallAttempts) {
    return { kind: 'CONTINUE', strategy: current };
  }
  const next = STALL_ESCALATION.find((s) => s !== current) ?? 'prerequisite_review';
  return { kind: 'SWITCH', strategy: next };
}

/**
 * AT-17: accept a correct response even when it uses a valid alternative solution
 * path; a rigid "only the expected path" rejection of a correct answer is wrong.
 */
export function evaluateResponse(input: {
  readonly correct: boolean;
  readonly usedApprovedAlternativePath: boolean;
}): 'accept' | 'reject' {
  return input.correct ? 'accept' : 'reject';
}

/**
 * AT-16: fast, high-guessing-risk responses get a reasoning probe rather than
 * being credited as mastery or punished.
 */
export function shouldProbeReasoning(input: {
  readonly correct: boolean;
  readonly guessingRisk: boolean;
}): boolean {
  return input.guessingRisk;
}
