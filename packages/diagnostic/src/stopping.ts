import type { DiagnosticPolicy } from './policy';
import { scoreAll, type DiagnosticCandidate } from './selection';

/**
 * Stopping rule (DIA-006; AT-05/07). Termination is driven by evidence confidence
 * and learner constraints — never a fixed question count.
 *
 * - SUFFICIENT: no remaining candidate clears the minimum probe score (enough
 *   confidence everywhere that matters).
 * - PARTIAL: a learner constraint stops the run with unresolved skills still
 *   open — attention budget exhausted, or the platform age ceiling reached
 *   (AT-07). Unresolved skills are returned explicitly as unknowns, with no
 *   negative/failure label (DIA-003/011).
 */

export type StopDecision =
  | { readonly kind: 'CONTINUE'; readonly nextSkillId: string }
  | { readonly kind: 'SUFFICIENT' }
  | {
      readonly kind: 'PARTIAL';
      readonly reason: 'ATTENTION_BUDGET' | 'AGE_CEILING';
      readonly unresolvedSkillIds: readonly string[];
    };

export interface StopInput {
  readonly candidates: readonly DiagnosticCandidate[];
  readonly learnerGrade: number;
  readonly probesUsed: number;
  /** True when the learner has hit the platform age/grade ceiling (AT-07). */
  readonly ageCeilingReached: boolean;
  readonly policy: DiagnosticPolicy;
}

function unresolved(
  candidates: readonly DiagnosticCandidate[],
  policy: DiagnosticPolicy,
): string[] {
  return candidates
    .filter((c) => c.priorConfidence < policy.sufficientConfidence)
    .map((c) => c.skillId)
    .sort();
}

export function decideStop(input: StopInput): StopDecision {
  const { candidates, learnerGrade, probesUsed, ageCeilingReached, policy } = input;
  const ranked = scoreAll(candidates, learnerGrade, policy);
  const top = ranked[0];

  // Confidence-based completion: nothing left worth probing.
  if (!top || top.score < policy.minProbeScore) {
    return { kind: 'SUFFICIENT' };
  }

  // Learner-constraint stops produce PARTIAL with explicit unknowns.
  if (ageCeilingReached) {
    return {
      kind: 'PARTIAL',
      reason: 'AGE_CEILING',
      unresolvedSkillIds: unresolved(candidates, policy),
    };
  }
  if (probesUsed >= policy.attentionBudget) {
    return {
      kind: 'PARTIAL',
      reason: 'ATTENTION_BUDGET',
      unresolvedSkillIds: unresolved(candidates, policy),
    };
  }

  return { kind: 'CONTINUE', nextSkillId: top.candidate.skillId };
}
