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
 *  DRAFT — Math strand: division facts (Grade 3)
 * ============================================================================
 * Ontario Grade 3 B2.3/B2.4 (rule-decidable slice — recall the division facts
 * related to the 2, 5 and 10 times tables, to 100 ÷ 10):
 *   SK-NS-div-facts   recall an exact division fact
 *
 * The division half of the Grade 3 multiplication/division family. Grade 3
 * facts are EXACT (no remainders); the quotient is computed by the deterministic
 * `integer_division` oracle and graded without a model. Authored as data in
 * `strands/data/division.json`. DRAFT ENGINEERING FIXTURE, NOT VALIDATED
 * CURRICULUM COVERAGE (ER-03 gate).
 */

const DIV = strand('division');

export const DIVISION_SKILLS: readonly CanonicalSkill[] = DIV.skills;
export const DIVISION_DEPENDENCIES: readonly SkillDependency[] = DIV.dependencies;
export const DIVISION_STRATEGIES: readonly InstructionalStrategy[] = DIV.strategies;
export const DIVISION_MISCONCEPTIONS: readonly MisconceptionDefinition[] = DIV.misconceptions;

export function buildDivisionDraftGraph(): CurriculumGraph {
  return strandGraph('division');
}
