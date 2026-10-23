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
 *  DRAFT — Math strand: place-value composition to 200 (Grade 2)
 * ============================================================================
 * Ontario Grade 2 B1.2 (rule-decidable slice — compose/decompose whole numbers
 * to 200 by hundreds, tens and ones):
 *   SK-NS-compose-200   name the whole number from hundreds, tens and ones
 *
 * Rides a DISTINCT `compose_hcto` oracle kind — the Grade 1 tens/ones
 * `place_value_compose` oracle (≤50) is left byte-identical. Authored as data in
 * `strands/data/place-value-g2.json`. DRAFT ENGINEERING FIXTURE, NOT VALIDATED
 * CURRICULUM COVERAGE (ER-03 gate).
 */

const PV = strand('place-value-g2');

export const PLACE_VALUE_G2_SKILLS: readonly CanonicalSkill[] = PV.skills;
export const PLACE_VALUE_G2_DEPENDENCIES: readonly SkillDependency[] = PV.dependencies;
export const PLACE_VALUE_G2_STRATEGIES: readonly InstructionalStrategy[] = PV.strategies;
export const PLACE_VALUE_G2_MISCONCEPTIONS: readonly MisconceptionDefinition[] = PV.misconceptions;

export function buildPlaceValueG2DraftGraph(): CurriculumGraph {
  return strandGraph('place-value-g2');
}
