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
 *  DRAFT — Math strand: multiply & divide integers (Grade 8)
 * ============================================================================
 * Ontario Grade 8 B2 / exp B2.7:
 *   SK-NS-integer-muldiv-signed   multiply and divide integers, including negatives
 *
 * a × b and a ÷ b over the integers with the sign rules, exact integer
 * arithmetic; division fails closed unless it divides exactly. A DISTINCT kind
 * from the Grade 7 `integer_addsub_signed` oracle. Authored as data in
 * `strands/data/integers-muldiv-g8.json`. DRAFT ENGINEERING FIXTURE, NOT
 * VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const INT = strand('integers-muldiv-g8');

export const INTEGERS_MULDIV_G8_SKILLS: readonly CanonicalSkill[] = INT.skills;
export const INTEGERS_MULDIV_G8_DEPENDENCIES: readonly SkillDependency[] = INT.dependencies;
export const INTEGERS_MULDIV_G8_STRATEGIES: readonly InstructionalStrategy[] = INT.strategies;
export const INTEGERS_MULDIV_G8_MISCONCEPTIONS: readonly MisconceptionDefinition[] =
  INT.misconceptions;

export function buildIntegersMulDivG8DraftGraph(): CurriculumGraph {
  return strandGraph('integers-muldiv-g8');
}
