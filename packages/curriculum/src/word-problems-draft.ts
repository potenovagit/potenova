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
 *  DRAFT — Math strand: addition/subtraction word problems (number sense)
 * ============================================================================
 * Ontario Grade 1 B2.4/B2.5 (represent and solve addition and subtraction
 * situations). Coached through the WORD-PROBLEM interaction: an authored,
 * templated story with known quantities and a known operation, graded by a
 * deterministic oracle — the comprehension is removed by templating, not by a
 * model.
 *   SK-NS-word-problem-addsub   solve an add/subtract story in context
 *
 * Authored as data in `strands/data/word-problems.json` and loaded by the shared
 * loader. DRAFT ENGINEERING FIXTURE, NOT VALIDATED CURRICULUM COVERAGE
 * (ER-03 gate).
 */

const WP = strand('word-problems');

export const WORD_PROBLEM_SKILLS: readonly CanonicalSkill[] = WP.skills;
export const WORD_PROBLEM_DEPENDENCIES: readonly SkillDependency[] = WP.dependencies;
export const WORD_PROBLEM_STRATEGIES: readonly InstructionalStrategy[] = WP.strategies;
export const WORD_PROBLEM_MISCONCEPTIONS: readonly MisconceptionDefinition[] = WP.misconceptions;

export function buildWordProblemsDraftGraph(): CurriculumGraph {
  return strandGraph('word-problems');
}
