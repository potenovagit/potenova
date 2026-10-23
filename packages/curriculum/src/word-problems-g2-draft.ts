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
 *  DRAFT — Math strand: addition/subtraction word problems to 100 (Grade 2)
 * ============================================================================
 * Ontario Grade 2 B2.4/B2.5 (rule-decidable slice — represent and solve
 * add/subtract situations to 100):
 *   SK-NS-word-problem-addsub-100   solve a two-digit add/subtract story
 *
 * Reuses the deterministic word_problem oracle unchanged — the story is
 * templated with known quantities and a known operation, so only the authored
 * numbers grow (to 100). Authored as data in
 * `strands/data/word-problems-g2.json`. DRAFT ENGINEERING FIXTURE, NOT
 * VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const WP = strand('word-problems-g2');

export const WORD_PROBLEMS_G2_SKILLS: readonly CanonicalSkill[] = WP.skills;
export const WORD_PROBLEMS_G2_DEPENDENCIES: readonly SkillDependency[] = WP.dependencies;
export const WORD_PROBLEMS_G2_STRATEGIES: readonly InstructionalStrategy[] = WP.strategies;
export const WORD_PROBLEMS_G2_MISCONCEPTIONS: readonly MisconceptionDefinition[] =
  WP.misconceptions;

export function buildWordProblemsG2DraftGraph(): CurriculumGraph {
  return strandGraph('word-problems-g2');
}
