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
 *  DRAFT — Math strand: multiply & divide by powers of ten (Grade 8)
 * ============================================================================
 * Ontario Grade 8 B2 / exp B2.3:
 *   SK-NS-power-of-ten-scale   multiply and divide whole and decimal numbers
 *                              (to thousandths) by powers of ten
 *
 * FLOAT-FREE: the operand is carried as an integer thousandths-count; scaling by
 * 10^k is exact integer arithmetic, and division fails closed when it would go
 * finer than thousandths. Authored as data in `strands/data/powers-of-ten-g8.json`.
 * DRAFT ENGINEERING FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const PT = strand('powers-of-ten-g8');

export const POWERS_OF_TEN_G8_SKILLS: readonly CanonicalSkill[] = PT.skills;
export const POWERS_OF_TEN_G8_DEPENDENCIES: readonly SkillDependency[] = PT.dependencies;
export const POWERS_OF_TEN_G8_STRATEGIES: readonly InstructionalStrategy[] = PT.strategies;
export const POWERS_OF_TEN_G8_MISCONCEPTIONS: readonly MisconceptionDefinition[] =
  PT.misconceptions;

export function buildPowersOfTenG8DraftGraph(): CurriculumGraph {
  return strandGraph('powers-of-ten-g8');
}
