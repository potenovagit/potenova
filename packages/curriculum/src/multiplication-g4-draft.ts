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
 *  DRAFT — Math strand: multi-digit multiplication (Grade 4)
 * ============================================================================
 * Ontario Grade 4 B2 / exp 13 (rule-decidable slice — multiply two- or
 * three-digit whole numbers by one-digit numbers and by 10, 100, 1000):
 *   SK-NS-mult-multidigit   compute a multi-digit product
 *
 * Rides a DISTINCT `multidigit_multiplication` oracle kind — the Grade 3
 * `integer_multiplication` fact oracle (factors 0–10) is left byte-identical,
 * since multi-digit computation is a different skill from fact recall. Authored
 * as data in `strands/data/multiplication-g4.json`. DRAFT ENGINEERING FIXTURE,
 * NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const MM = strand('multiplication-g4');

export const MULTIPLICATION_G4_SKILLS: readonly CanonicalSkill[] = MM.skills;
export const MULTIPLICATION_G4_DEPENDENCIES: readonly SkillDependency[] = MM.dependencies;
export const MULTIPLICATION_G4_STRATEGIES: readonly InstructionalStrategy[] = MM.strategies;
export const MULTIPLICATION_G4_MISCONCEPTIONS: readonly MisconceptionDefinition[] =
  MM.misconceptions;

export function buildMultiplicationG4DraftGraph(): CurriculumGraph {
  return strandGraph('multiplication-g4');
}
