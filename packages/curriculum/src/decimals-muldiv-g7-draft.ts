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
 *  DRAFT — Math strand: multiply & divide decimals (Grade 7)
 * ============================================================================
 * Ontario Grade 7 B2 / exp B2.9:
 *   SK-NS-decimal-muldiv   multiply and divide decimal numbers by decimal numbers
 *
 * FLOAT-FREE: operands carried as integer hundredths, the result compared as an
 * integer ten-thousandths count (exact integer arithmetic); division fails
 * closed when the quotient does not terminate within four decimal places. A
 * DISTINCT kind from the G4–G6 decimal compare/round oracles. Authored as data
 * in `strands/data/decimals-muldiv-g7.json`. DRAFT ENGINEERING FIXTURE, NOT
 * VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const DMD = strand('decimals-muldiv-g7');

export const DECIMALS_MULDIV_G7_SKILLS: readonly CanonicalSkill[] = DMD.skills;
export const DECIMALS_MULDIV_G7_DEPENDENCIES: readonly SkillDependency[] = DMD.dependencies;
export const DECIMALS_MULDIV_G7_STRATEGIES: readonly InstructionalStrategy[] = DMD.strategies;
export const DECIMALS_MULDIV_G7_MISCONCEPTIONS: readonly MisconceptionDefinition[] =
  DMD.misconceptions;

export function buildDecimalsMulDivG7DraftGraph(): CurriculumGraph {
  return strandGraph('decimals-muldiv-g7');
}
