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
 *  DRAFT — Math strand: scientific notation (Grade 8)
 * ============================================================================
 * Ontario Grade 8 B1 / exp B1.1:
 *   SK-NS-scientific-notation   expand a number in scientific notation (a × 10^b,
 *                               1 ≤ a < 10) into standard form
 *
 * Exact integer arithmetic (coefficient carried as hundredths); fails closed
 * when the standard form is not a whole number. Authored as data in
 * `strands/data/scientific-notation-g8.json`. DRAFT ENGINEERING FIXTURE, NOT
 * VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const SCI = strand('scientific-notation-g8');

export const SCIENTIFIC_NOTATION_G8_SKILLS: readonly CanonicalSkill[] = SCI.skills;
export const SCIENTIFIC_NOTATION_G8_DEPENDENCIES: readonly SkillDependency[] = SCI.dependencies;
export const SCIENTIFIC_NOTATION_G8_STRATEGIES: readonly InstructionalStrategy[] = SCI.strategies;
export const SCIENTIFIC_NOTATION_G8_MISCONCEPTIONS: readonly MisconceptionDefinition[] =
  SCI.misconceptions;

export function buildScientificNotationG8DraftGraph(): CurriculumGraph {
  return strandGraph('scientific-notation-g8');
}
