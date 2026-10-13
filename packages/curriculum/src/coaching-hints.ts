import type { MisconceptionDefinition, InstructionalStrategy } from './entities';

/**
 * Misconception → remediation-strategy hints for a skill (LRN-007 KB). These are
 * the first rung of the coaching ladder: a targeted, AUTHORED hint shown on an
 * early wrong answer, before the stall-driven strategy change. Authored (not
 * model-generated) curriculum content, so it is safe to surface directly.
 */
export interface SkillHint {
  readonly misconceptionId: string;
  /** The error pattern this hint counters (metadata for the tutor, not the child). */
  readonly pattern: string;
  readonly strategyId: string;
  /** The actionable instruction (child-facing). */
  readonly intent: string;
  readonly representations: readonly string[];
}

/**
 * Ordered hints for a skill: for each misconception mapped to the skill, one hint
 * per remediation strategy, in KB order. The first is the gentlest rung; later
 * entries form the ladder. Returns [] when the KB has no misconception for the
 * skill (e.g. a subject with no misconception KB yet).
 */
export function hintsForSkill(
  skillId: string,
  misconceptions: readonly MisconceptionDefinition[],
  strategies: readonly InstructionalStrategy[],
): SkillHint[] {
  const byId = new Map(strategies.map((s) => [s.strategyId, s]));
  const out: SkillHint[] = [];
  for (const m of misconceptions.filter((m) => m.skillId === skillId)) {
    for (const sid of m.remediationStrategyIds) {
      const s = byId.get(sid);
      if (s) {
        out.push({
          misconceptionId: m.misconceptionId,
          pattern: m.pattern,
          strategyId: s.strategyId,
          intent: s.intent,
          representations: s.representations,
        });
      }
    }
  }
  return out;
}
