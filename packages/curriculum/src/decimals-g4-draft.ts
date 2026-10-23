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
 *  DRAFT — Math strand: decimal tenths (Grade 4)
 * ============================================================================
 * Ontario Grade 4 B1 / exp 6, 7, 8 (rule-decidable slice — decimal tenths):
 *   SK-NS-decimal-compare          compare and order decimal tenths
 *   SK-NS-decimal-round            round a decimal to the nearest whole number
 *   SK-NS-fraction-decimal-equiv   relate a fraction to a decimal tenth
 *
 * The first decimal strand — a new representation. Every item is carried as an
 * integer tenths-count (value = tenths / 10), so the deterministic oracles are
 * FLOAT-FREE and graded without a model. Authored as data in
 * `strands/data/decimals-g4.json`. DRAFT ENGINEERING FIXTURE, NOT VALIDATED
 * CURRICULUM COVERAGE (ER-03 gate).
 */

const DEC = strand('decimals-g4');

export const DECIMALS_G4_SKILLS: readonly CanonicalSkill[] = DEC.skills;
export const DECIMALS_G4_DEPENDENCIES: readonly SkillDependency[] = DEC.dependencies;
export const DECIMALS_G4_STRATEGIES: readonly InstructionalStrategy[] = DEC.strategies;
export const DECIMALS_G4_MISCONCEPTIONS: readonly MisconceptionDefinition[] = DEC.misconceptions;

export function buildDecimalsG4DraftGraph(): CurriculumGraph {
  return strandGraph('decimals-g4');
}
