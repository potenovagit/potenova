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
 *  DRAFT — Math strand: two-digit × two-digit multiplication (Grade 5)
 * ============================================================================
 * Ontario Grade 5 B2 / exp 12 (rule-decidable slice — multiply two-digit whole
 * numbers by two-digit whole numbers):
 *   SK-NS-mult-2x2   compute a two-digit × two-digit product
 *
 * Rides a DISTINCT `mult_2x2` oracle kind — the Grade 4
 * `multidigit_multiplication` oracle (×1-digit / ×powers of ten) is left
 * byte-identical, since a two-digit multiplier (partial products across both
 * places) is a different skill. Authored as data in
 * `strands/data/multiplication-g5.json`. DRAFT ENGINEERING FIXTURE, NOT
 * VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const MM = strand('multiplication-g5');

export const MULTIPLICATION_G5_SKILLS: readonly CanonicalSkill[] = MM.skills;
export const MULTIPLICATION_G5_DEPENDENCIES: readonly SkillDependency[] = MM.dependencies;
export const MULTIPLICATION_G5_STRATEGIES: readonly InstructionalStrategy[] = MM.strategies;
export const MULTIPLICATION_G5_MISCONCEPTIONS: readonly MisconceptionDefinition[] =
  MM.misconceptions;

export function buildMultiplicationG5DraftGraph(): CurriculumGraph {
  return strandGraph('multiplication-g5');
}
