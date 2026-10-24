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
 *  DRAFT — Math strand: estimate square roots (Grade 8)
 * ============================================================================
 * Ontario Grade 8 B1 / exp B1.3:
 *   SK-NS-sqrt-between   estimate the square root of a non-perfect-square
 *                        between two consecutive whole numbers
 *
 * Exact integer floor-sqrt (no floats); defined ONLY for non-perfect squares,
 * so it never overlaps the Grade 7 exact `perfect_square_root` skill. Authored
 * as data in `strands/data/sqrt-estimate-g8.json`. DRAFT ENGINEERING FIXTURE,
 * NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const SQE = strand('sqrt-estimate-g8');

export const SQRT_ESTIMATE_G8_SKILLS: readonly CanonicalSkill[] = SQE.skills;
export const SQRT_ESTIMATE_G8_DEPENDENCIES: readonly SkillDependency[] = SQE.dependencies;
export const SQRT_ESTIMATE_G8_STRATEGIES: readonly InstructionalStrategy[] = SQE.strategies;
export const SQRT_ESTIMATE_G8_MISCONCEPTIONS: readonly MisconceptionDefinition[] =
  SQE.misconceptions;

export function buildSqrtEstimateG8DraftGraph(): CurriculumGraph {
  return strandGraph('sqrt-estimate-g8');
}
