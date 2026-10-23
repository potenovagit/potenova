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
 *  DRAFT — Math strand: multiplication facts (Grade 3)
 * ============================================================================
 * Ontario Grade 3 B2.3/B2.4 (rule-decidable slice — recall and represent
 * multiplication facts up to 10 × 10):
 *   SK-NS-mult-facts   recall a single-digit multiplication fact
 *
 * The first skill of the Grade 3 multiplication/division family. The fact is
 * computed exactly by the deterministic `integer_multiplication` oracle and
 * graded without a model. Authored as data in `strands/data/multiplication.json`.
 * DRAFT ENGINEERING FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const MULT = strand('multiplication');

export const MULTIPLICATION_SKILLS: readonly CanonicalSkill[] = MULT.skills;
export const MULTIPLICATION_DEPENDENCIES: readonly SkillDependency[] = MULT.dependencies;
export const MULTIPLICATION_STRATEGIES: readonly InstructionalStrategy[] = MULT.strategies;
export const MULTIPLICATION_MISCONCEPTIONS: readonly MisconceptionDefinition[] =
  MULT.misconceptions;

export function buildMultiplicationDraftGraph(): CurriculumGraph {
  return strandGraph('multiplication');
}
