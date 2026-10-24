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
 *  DRAFT — Math strand: decimals to hundredths (Grade 5)
 * ============================================================================
 * Ontario Grade 5 B1 / exp 4, 5 (rule-decidable slice — decimals up to
 * hundredths):
 *   SK-NS-decimal-hundredth-compare   compare and order decimals to hundredths
 *   SK-NS-decimal-round-tenth         round a decimal to the nearest tenth
 *
 * The ×100 extension of the Grade 4 float-free decimal model: a decimal is
 * carried as its integer hundredths-count (value = hundredths/100). The G4
 * tenths oracles are a separate kind and stay byte-identical. Authored as data
 * in `strands/data/decimals-g5.json`. DRAFT ENGINEERING FIXTURE, NOT VALIDATED
 * CURRICULUM COVERAGE (ER-03 gate).
 */

const DEC = strand('decimals-g5');

export const DECIMALS_G5_SKILLS: readonly CanonicalSkill[] = DEC.skills;
export const DECIMALS_G5_DEPENDENCIES: readonly SkillDependency[] = DEC.dependencies;
export const DECIMALS_G5_STRATEGIES: readonly InstructionalStrategy[] = DEC.strategies;
export const DECIMALS_G5_MISCONCEPTIONS: readonly MisconceptionDefinition[] = DEC.misconceptions;

export function buildDecimalsG5DraftGraph(): CurriculumGraph {
  return strandGraph('decimals-g5');
}
