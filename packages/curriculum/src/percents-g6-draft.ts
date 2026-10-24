import type { CurriculumGraph } from './graph';
import type {
  CanonicalSkill,
  SkillDependency,
  MisconceptionDefinition,
  InstructionalStrategy,
} from './entities';
import { strand, strandGraph } from './strands';

/**
 * ============================================================================
 *  DRAFT — Math strand: percent of a number (Grade 6)
 * ============================================================================
 * Ontario Grade 6 B2 / exp 8 (rule-decidable slice — whole-number results):
 *   SK-NS-percent-of   determine a percent of a whole number
 *
 * pct% of n = n·pct/100 by exact integer arithmetic; the oracle fails closed
 * when the result is not a whole number, so the engineering slice stays in
 * clean whole-number answers. Authored as data in `strands/data/percents-g6.json`.
 * DRAFT ENGINEERING FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const PCT = strand('percents-g6');

export const PERCENTS_G6_SKILLS: readonly CanonicalSkill[] = PCT.skills;
export const PERCENTS_G6_DEPENDENCIES: readonly SkillDependency[] = PCT.dependencies;
export const PERCENTS_G6_STRATEGIES: readonly InstructionalStrategy[] = PCT.strategies;
export const PERCENTS_G6_MISCONCEPTIONS: readonly MisconceptionDefinition[] = PCT.misconceptions;

export function buildPercentsG6DraftGraph(): CurriculumGraph {
  return strandGraph('percents-g6');
}
