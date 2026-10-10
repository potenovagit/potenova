import type { SkillState } from '@potenova/domain-core';
import type { DiagnosticPolicy } from './policy';

/**
 * Information-gain-driven probe selection (DIA-001/006/012; AI Learning Eval §3).
 *
 * Select the task that maximizes a multi-objective score — expected information
 * gain, foundational dependency weight, grade relevance and task diversity —
 * subject to hard validity exclusions (invalid age/rubric/region/modality tasks
 * are never selectable, DIA-012). Selection is pure and deterministic: ties break
 * by skillId so a run is reproducible for audit.
 *
 * There is no fixed question count anywhere here; when no candidate clears the
 * policy's minimum probe score the run has enough confidence to stop (see
 * stopping.ts).
 */

export interface DiagnosticCandidate {
  readonly skillId: string;
  /** Nominal grade of the skill (from the reviewed curriculum expectation). */
  readonly grade: number;
  /** Current placement confidence 0..1 (from a shadow projection over placement evidence). */
  readonly priorConfidence: number;
  readonly priorState: SkillState;
  /** Distinct representations already covered by unaided evidence (diversity signal). */
  readonly representationsCovered: number;
  /** How many target skills transitively depend on this one (foundational weight). */
  readonly foundationalFanout: number;
  /** Hard validity: age/rubric/region/modality calibrated and accessible (DIA-012). */
  readonly valid: boolean;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Score a candidate for the learner's registered grade. Returns 0 for an
 * already-resolved skill (>= sufficientConfidence) so confirmed, untouched skills
 * are not needlessly reassessed (reuse, DIA-002/AT-06).
 */
export function scoreCandidate(
  c: DiagnosticCandidate,
  learnerGrade: number,
  policy: DiagnosticPolicy,
): number {
  if (!c.valid) return Number.NEGATIVE_INFINITY;
  if (c.priorConfidence >= policy.sufficientConfidence) return 0;

  const w = policy.weights;
  const infoGain = 1 - clamp01(c.priorConfidence); // low confidence => high gain
  const foundational = clamp01(c.foundationalFanout / 4); // normalized placeholder scale
  const gradeRelevance = 1 - clamp01(Math.abs(c.grade - learnerGrade) / 8);
  const diversityPenalty = clamp01(c.representationsCovered / 3);

  return (
    w.infoGain * infoGain +
    w.foundational * foundational +
    w.gradeRelevance * gradeRelevance -
    w.diversity * diversityPenalty
  );
}

export interface ScoredCandidate {
  readonly candidate: DiagnosticCandidate;
  readonly score: number;
}

export function scoreAll(
  candidates: readonly DiagnosticCandidate[],
  learnerGrade: number,
  policy: DiagnosticPolicy,
): ScoredCandidate[] {
  return candidates
    .filter((c) => c.valid)
    .map((c) => ({ candidate: c, score: scoreCandidate(c, learnerGrade, policy) }))
    .sort((a, b) =>
      b.score !== a.score
        ? b.score - a.score
        : a.candidate.skillId.localeCompare(b.candidate.skillId),
    );
}

/** The single next probe, or null when nothing is worth probing (→ SUFFICIENT). */
export function selectNextProbe(
  candidates: readonly DiagnosticCandidate[],
  learnerGrade: number,
  policy: DiagnosticPolicy,
): DiagnosticCandidate | null {
  const ranked = scoreAll(candidates, learnerGrade, policy);
  const top = ranked[0];
  if (!top || top.score < policy.minProbeScore) return null;
  return top.candidate;
}
