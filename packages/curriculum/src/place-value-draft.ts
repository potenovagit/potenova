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
 *  DRAFT — Math strand: place-value composition to 50 (number sense)
 * ============================================================================
 * Ontario Grade 1 B1.2 (rule-decidable slice — compose a whole number to 50
 * from tens and ones):
 *   SK-NS-compose-50   name the number made from a count of tens and ones
 *
 * Authored as data in `strands/data/place-value.json` and loaded by the shared
 * loader; the named exports are preserved for consumers. DRAFT ENGINEERING
 * FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const PV = strand('place-value');

export const PLACE_VALUE_SKILLS: readonly CanonicalSkill[] = PV.skills;
export const PLACE_VALUE_DEPENDENCIES: readonly SkillDependency[] = PV.dependencies;
export const PLACE_VALUE_STRATEGIES: readonly InstructionalStrategy[] = PV.strategies;
export const PLACE_VALUE_MISCONCEPTIONS: readonly MisconceptionDefinition[] = PV.misconceptions;

export function buildPlaceValueDraftGraph(): CurriculumGraph {
  return strandGraph('place-value');
}
