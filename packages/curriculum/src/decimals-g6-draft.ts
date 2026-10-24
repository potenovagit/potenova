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
 *  DRAFT — Math strand: decimals to thousandths (Grade 6)
 * ============================================================================
 * Ontario Grade 6 B1 / exp 3, 4 (rule-decidable slice — decimals up to
 * thousandths):
 *   SK-NS-decimal-thousandth-compare   compare and order decimals to thousandths
 *   SK-NS-decimal-round-hundredth      round a decimal to the nearest hundredth
 *
 * The ×1000 extension of the float-free decimal model (G4 tenths, G5 hundredths):
 * a decimal is carried as its integer thousandths-count (value = thousandths/1000).
 * The earlier decimal oracles are separate kinds and stay byte-identical.
 * Authored as data in `strands/data/decimals-g6.json`. DRAFT ENGINEERING
 * FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const DEC = strand('decimals-g6');

export const DECIMALS_G6_SKILLS: readonly CanonicalSkill[] = DEC.skills;
export const DECIMALS_G6_DEPENDENCIES: readonly SkillDependency[] = DEC.dependencies;
export const DECIMALS_G6_STRATEGIES: readonly InstructionalStrategy[] = DEC.strategies;
export const DECIMALS_G6_MISCONCEPTIONS: readonly MisconceptionDefinition[] = DEC.misconceptions;

export function buildDecimalsG6DraftGraph(): CurriculumGraph {
  return strandGraph('decimals-g6');
}
