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
 *  DRAFT — Math strand: compare & order whole numbers to 50 (number sense)
 * ============================================================================
 * Ontario Grade 1 B1.3 (compare and order whole numbers to 50):
 *   SK-NS-compare-whole-50   decide the relation of two whole numbers   [entry]
 *   SK-NS-order-whole-50     order a small set least→greatest           [depends on compare]
 *
 * Authored as data in `strands/data/whole-number.json` and loaded by the shared
 * loader; the named exports are preserved for consumers. DRAFT ENGINEERING
 * FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const WN = strand('whole-number');

export const WHOLE_NUMBER_SKILLS: readonly CanonicalSkill[] = WN.skills;
export const WHOLE_NUMBER_DEPENDENCIES: readonly SkillDependency[] = WN.dependencies;
export const WHOLE_NUMBER_STRATEGIES: readonly InstructionalStrategy[] = WN.strategies;
export const WHOLE_NUMBER_MISCONCEPTIONS: readonly MisconceptionDefinition[] = WN.misconceptions;

export function buildWholeNumberDraftGraph(): CurriculumGraph {
  return strandGraph('whole-number');
}
