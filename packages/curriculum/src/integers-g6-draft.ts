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
 *  DRAFT — Math strand: integers (Grade 6)
 * ============================================================================
 * Ontario Grade 6 B1 / exp 1, 2 (rule-decidable slice — read, compare and order
 * integers including negatives):
 *   SK-NS-integer-signed-compare   compare two integers on the number line
 *
 * Negatives enter the engine here. Rides a DISTINCT `integer_signed_compare`
 * oracle kind — the whole-number `integer_comparison` oracle is non-negative
 * only and stays byte-identical. Authored as data in
 * `strands/data/integers-g6.json`. DRAFT ENGINEERING FIXTURE, NOT VALIDATED
 * CURRICULUM COVERAGE (ER-03 gate).
 */

const INT = strand('integers-g6');

export const INTEGERS_G6_SKILLS: readonly CanonicalSkill[] = INT.skills;
export const INTEGERS_G6_DEPENDENCIES: readonly SkillDependency[] = INT.dependencies;
export const INTEGERS_G6_STRATEGIES: readonly InstructionalStrategy[] = INT.strategies;
export const INTEGERS_G6_MISCONCEPTIONS: readonly MisconceptionDefinition[] = INT.misconceptions;

export function buildIntegersG6DraftGraph(): CurriculumGraph {
  return strandGraph('integers-g6');
}
