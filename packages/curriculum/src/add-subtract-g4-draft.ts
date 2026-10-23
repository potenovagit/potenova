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
 *  DRAFT — Math strand: add and subtract to 10 000 (Grade 4)
 * ============================================================================
 * Ontario Grade 4 B2 / exp 12 (rule-decidable slice — add and subtract whole
 * numbers that add up to no more than 10 000):
 *   SK-NS-add-within10000   add with sums to 10 000
 *   SK-NS-sub-within10000   subtract within 10 000 (regrouping)
 *
 * A pure bound bump — reuses the Grade 1 `integer_addition` and
 * `integer_subtraction` oracles UNCHANGED (both already fail-closed, the sum/
 * difference exact and non-negative); only the authored operands grow. Authored
 * as data in `strands/data/add-subtract-g4.json`. DRAFT ENGINEERING FIXTURE, NOT
 * VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const AS = strand('add-subtract-g4');

export const ADD_SUBTRACT_G4_SKILLS: readonly CanonicalSkill[] = AS.skills;
export const ADD_SUBTRACT_G4_DEPENDENCIES: readonly SkillDependency[] = AS.dependencies;
export const ADD_SUBTRACT_G4_STRATEGIES: readonly InstructionalStrategy[] = AS.strategies;
export const ADD_SUBTRACT_G4_MISCONCEPTIONS: readonly MisconceptionDefinition[] = AS.misconceptions;

export function buildAddSubtractG4DraftGraph(): CurriculumGraph {
  return strandGraph('add-subtract-g4');
}
