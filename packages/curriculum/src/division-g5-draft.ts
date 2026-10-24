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
 *  DRAFT — Math strand: 3-digit ÷ 2-digit division (Grade 5)
 * ============================================================================
 * Ontario Grade 5 B2 / exp 13 (rule-decidable slice — divide three-digit whole
 * numbers by two-digit whole numbers, expressing the remainder):
 *   SK-NS-div-2digit   give the quotient and the remainder
 *
 * Rides a DISTINCT `division_2digit` oracle kind — the Grade 4
 * `division_with_remainder` oracle (one-digit divisor) is left byte-identical.
 * Authored as data in `strands/data/division-g5.json`. DRAFT ENGINEERING
 * FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const DR = strand('division-g5');

export const DIVISION_G5_SKILLS: readonly CanonicalSkill[] = DR.skills;
export const DIVISION_G5_DEPENDENCIES: readonly SkillDependency[] = DR.dependencies;
export const DIVISION_G5_STRATEGIES: readonly InstructionalStrategy[] = DR.strategies;
export const DIVISION_G5_MISCONCEPTIONS: readonly MisconceptionDefinition[] = DR.misconceptions;

export function buildDivisionG5DraftGraph(): CurriculumGraph {
  return strandGraph('division-g5');
}
