import { DomainError } from '@potenova/contracts';
import type { CurriculumGraph } from '@potenova/curriculum';
import { prioritize, type ObjectiveSignal, type PrioritizedObjective } from './priority';
import type { PlannerPolicy } from './policy';

/**
 * Adaptive next-objective selection (WP: adaptive planner + remediation).
 *
 * The planner chooses what to coach next by reading the learner's derived
 * mastery against the REVIEW-CONTROLLED canonical skill graph — never a fixed
 * task order. It reuses {@link prioritize}'s reason-coded classification and adds
 * the one piece that needs the graph: resolving a prerequisite-blocked objective
 * down to the concrete weak prerequisite that should be remediated first.
 *
 * Governance notes:
 *  - Mastery here is READ, never written. Selection cannot set mastery; the
 *    mastery authority (immutable evidence + shadow projection) stays the only
 *    source of truth (`domain-core/mastery-authority`).
 *  - Only APPROVED prerequisite edges are traversed (via the graph), so an
 *    unreviewed AI-proposed edge can never alter a learner's path (LRN-007).
 *  - `coachableSkillIds` is the oracle-validatable subset for the synthetic
 *    slice. Prerequisites OUTSIDE that subset (lower skills with no validatable
 *    task yet) are treated as satisfied-by-placement, not invented as mastered —
 *    they simply aren't candidates the planner can act on.
 */

/** A read-only snapshot of one skill's derived mastery (from the projection). */
export interface SkillMastery {
  readonly confidence: number;
  readonly independent: boolean;
}

export interface NextObjective {
  /** The concrete skill to coach next (a remediation prerequisite, or the top pick). */
  readonly targetSkillId: string;
  /** When the top pick was prerequisite-blocked, the skill it was blocked ON. */
  readonly blockedSkillId: string | null;
  readonly reasonCode: PrioritizedObjective['reasonCode'];
  /** The full ranked list (for evidence / explainability). */
  readonly ranked: readonly PrioritizedObjective[];
}

const NO_MASTERY: SkillMastery = { confidence: 0, independent: false };

export function selectNextObjective(args: {
  readonly graph: CurriculumGraph;
  readonly coachableSkillIds: readonly string[];
  readonly mastery: Readonly<Record<string, SkillMastery>>;
  readonly policy: PlannerPolicy;
}): NextObjective {
  const { graph, coachableSkillIds, mastery, policy } = args;
  if (coachableSkillIds.length === 0) {
    throw new DomainError('NOT_FOUND', 'no coachable skills configured');
  }
  const coachable = new Set(coachableSkillIds);
  const masteryOf = (id: string): SkillMastery => mastery[id] ?? NO_MASTERY;

  // Prerequisites the planner can actually act on: approved edges whose source is
  // itself a coachable skill. Lower, non-oracle prerequisites are not candidates.
  const coachablePrereqs = (id: string): string[] =>
    graph.directPrerequisites(id).filter((p) => coachable.has(p));

  const signals: ObjectiveSignal[] = coachableSkillIds.map((skillId) => {
    const m = masteryOf(skillId);
    const prereqs = coachablePrereqs(skillId);
    const prerequisiteGap = prereqs.some((p) => !masteryOf(p).independent);
    const allPrereqsIndependent = prereqs.every((p) => masteryOf(p).independent);
    return {
      skillId,
      safetyBlocked: false,
      prerequisiteGap,
      highDependency: false,
      retentionRisk: false,
      masteryConfidence: m.confidence,
      unresolvedConfidence: false,
      schoolPriority: false,
      isTransfer: false,
      isAdvancement: allPrereqsIndependent && !m.independent,
      parentPreferred: false,
    };
  });

  const ranked = prioritize(signals, policy);
  const top = ranked.find((r) => !r.suppressed) ?? ranked[0];
  if (!top) throw new DomainError('NOT_FOUND', 'no coachable objective');

  // A prerequisite-blocked objective resolves to its weakest coachable, not-yet-
  // independent prerequisite — that is the concrete skill to remediate first.
  if (top.reasonCode === 'PREREQUISITE_REMEDIATION') {
    const weak = coachablePrereqs(top.skillId)
      .filter((p) => !masteryOf(p).independent)
      .sort((a, b) => masteryOf(a).confidence - masteryOf(b).confidence || a.localeCompare(b));
    const target = weak[0];
    if (target) {
      return {
        targetSkillId: target,
        blockedSkillId: top.skillId,
        reasonCode: top.reasonCode,
        ranked,
      };
    }
  }

  return { targetSkillId: top.skillId, blockedSkillId: null, reasonCode: top.reasonCode, ranked };
}
