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
 *  DRAFT — Math strand: multiply & divide fractions (Grade 7)
 * ============================================================================
 * Ontario Grade 7 B2 / exp B2.8:
 *   SK-NS-fraction-muldiv   multiply and divide fractions by fractions
 *
 * (a/b)×(c/d) = ac/bd; (a/b)÷(c/d) = ad/bc. Exact integer arithmetic, graded by
 * value; a DISTINCT kind from the G5 like- and G6 unlike-denominator add/subtract
 * oracles. Authored as data in `strands/data/fractions-muldiv-g7.json`. DRAFT
 * ENGINEERING FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const FMD = strand('fractions-muldiv-g7');

export const FRACTIONS_MULDIV_G7_SKILLS: readonly CanonicalSkill[] = FMD.skills;
export const FRACTIONS_MULDIV_G7_DEPENDENCIES: readonly SkillDependency[] = FMD.dependencies;
export const FRACTIONS_MULDIV_G7_STRATEGIES: readonly InstructionalStrategy[] = FMD.strategies;
export const FRACTIONS_MULDIV_G7_MISCONCEPTIONS: readonly MisconceptionDefinition[] =
  FMD.misconceptions;

export function buildFractionsMulDivG7DraftGraph(): CurriculumGraph {
  return strandGraph('fractions-muldiv-g7');
}
