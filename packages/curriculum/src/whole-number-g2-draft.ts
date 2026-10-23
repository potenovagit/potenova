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
 *  DRAFT — Math strand: compare & order whole numbers to 200 (Grade 2)
 * ============================================================================
 * Ontario Grade 2 B1.2 (compare and order whole numbers to 200). The first
 * Grade 2 skill — the same compare/order oracle as G1, at the higher bound, so
 * the per-grade loop reuses the engine rather than adding capability.
 *   SK-NS-compare-whole-200   decide the relation of two whole numbers to 200
 *   SK-NS-order-whole-200     order a small set least→greatest to 200
 *
 * Authored as data in `strands/data/whole-number-g2.json`. DRAFT ENGINEERING
 * FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const WN2 = strand('whole-number-g2');

export const WHOLE_NUMBER_G2_SKILLS: readonly CanonicalSkill[] = WN2.skills;
export const WHOLE_NUMBER_G2_DEPENDENCIES: readonly SkillDependency[] = WN2.dependencies;
export const WHOLE_NUMBER_G2_STRATEGIES: readonly InstructionalStrategy[] = WN2.strategies;
export const WHOLE_NUMBER_G2_MISCONCEPTIONS: readonly MisconceptionDefinition[] =
  WN2.misconceptions;

export function buildWholeNumberG2DraftGraph(): CurriculumGraph {
  return strandGraph('whole-number-g2');
}
