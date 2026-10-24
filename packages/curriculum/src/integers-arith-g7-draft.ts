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
 *  DRAFT — Math strand: add & subtract integers (Grade 7)
 * ============================================================================
 * Ontario Grade 7 B2 / exp B2.4:
 *   SK-NS-integer-addsub-signed   add and subtract integers, including negatives
 *
 * A DISTINCT kind from the Grade 6 `integer_signed_compare` skill (ordering)
 * and the Grade 1 non-negative addition/subtraction fact skills: this one
 * admits negative operands and negative results, graded by exact integer value.
 * Authored as data in `strands/data/integers-arith-g7.json`. DRAFT ENGINEERING
 * FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const INT = strand('integers-arith-g7');

export const INTEGERS_ARITH_G7_SKILLS: readonly CanonicalSkill[] = INT.skills;
export const INTEGERS_ARITH_G7_DEPENDENCIES: readonly SkillDependency[] = INT.dependencies;
export const INTEGERS_ARITH_G7_STRATEGIES: readonly InstructionalStrategy[] = INT.strategies;
export const INTEGERS_ARITH_G7_MISCONCEPTIONS: readonly MisconceptionDefinition[] =
  INT.misconceptions;

export function buildIntegersArithG7DraftGraph(): CurriculumGraph {
  return strandGraph('integers-arith-g7');
}
