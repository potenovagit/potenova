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
 *  DRAFT — Math strand: proportional reasoning (Grade 7)
 * ============================================================================
 * Ontario Grade 7 B2 / exp B2.10:
 *   SK-NS-proportion-solve   solve for a missing term in a proportion a/b = c/x
 *
 * x = b·c / a by exact integer cross-multiplication; fails closed when the
 * missing term is not a whole number. Authored as data in
 * `strands/data/proportions-g7.json`. DRAFT ENGINEERING FIXTURE, NOT VALIDATED
 * CURRICULUM COVERAGE (ER-03 gate).
 */

const PROP = strand('proportions-g7');

export const PROPORTIONS_G7_SKILLS: readonly CanonicalSkill[] = PROP.skills;
export const PROPORTIONS_G7_DEPENDENCIES: readonly SkillDependency[] = PROP.dependencies;
export const PROPORTIONS_G7_STRATEGIES: readonly InstructionalStrategy[] = PROP.strategies;
export const PROPORTIONS_G7_MISCONCEPTIONS: readonly MisconceptionDefinition[] =
  PROP.misconceptions;

export function buildProportionsG7DraftGraph(): CurriculumGraph {
  return strandGraph('proportions-g7');
}
