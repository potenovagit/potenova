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
 *  DRAFT — Math strand: division with remainder (Grade 4)
 * ============================================================================
 * Ontario Grade 4 B2 / exp 14 (rule-decidable slice — divide a two- or
 * three-digit whole number by a one-digit number, expressing the remainder):
 *   SK-NS-div-remainder   give the quotient and the remainder
 *
 * Rides a DISTINCT `division_with_remainder` oracle kind — the Grade 3
 * `integer_division` fact oracle (exact division, fail-closed on any remainder)
 * is left byte-identical. Authored as data in `strands/data/division-g4.json`.
 * DRAFT ENGINEERING FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const DR = strand('division-g4');

export const DIVISION_G4_SKILLS: readonly CanonicalSkill[] = DR.skills;
export const DIVISION_G4_DEPENDENCIES: readonly SkillDependency[] = DR.dependencies;
export const DIVISION_G4_STRATEGIES: readonly InstructionalStrategy[] = DR.strategies;
export const DIVISION_G4_MISCONCEPTIONS: readonly MisconceptionDefinition[] = DR.misconceptions;

export function buildDivisionG4DraftGraph(): CurriculumGraph {
  return strandGraph('division-g4');
}
