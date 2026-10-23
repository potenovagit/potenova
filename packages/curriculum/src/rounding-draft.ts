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
 *  DRAFT — Math strand: rounding whole numbers (Grade 4)
 * ============================================================================
 * Ontario Grade 4 B1 / exp 2 (rule-decidable slice — round whole numbers to the
 * nearest ten, hundred, or thousand):
 *   SK-NS-round-whole   round to a named place
 *
 * The first Grade 4 skill. The rounded value is computed exactly (round-half-up)
 * by the deterministic `round_whole` oracle and graded without a model. Authored
 * as data in `strands/data/rounding.json`. DRAFT ENGINEERING FIXTURE, NOT
 * VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const RND = strand('rounding');

export const ROUNDING_SKILLS: readonly CanonicalSkill[] = RND.skills;
export const ROUNDING_DEPENDENCIES: readonly SkillDependency[] = RND.dependencies;
export const ROUNDING_STRATEGIES: readonly InstructionalStrategy[] = RND.strategies;
export const ROUNDING_MISCONCEPTIONS: readonly MisconceptionDefinition[] = RND.misconceptions;

export function buildRoundingDraftGraph(): CurriculumGraph {
  return strandGraph('rounding');
}
