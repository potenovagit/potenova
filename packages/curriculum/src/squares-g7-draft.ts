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
 *  DRAFT — Math strand: perfect squares & square roots (Grade 7)
 * ============================================================================
 * Ontario Grade 7 B1 / exp B1.2 (rule-decidable slice):
 *   SK-NS-is-perfect-square     identify whether a whole number is a perfect square
 *   SK-NS-perfect-square-root   determine the square root of a perfect square
 *
 * Both graded by exact integer arithmetic (a factor r with r·r = n); the
 * root skill fails closed on a non-perfect-square so a child is never asked for
 * a root that does not exist. Authored as data in `strands/data/squares-g7.json`.
 * DRAFT ENGINEERING FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const SQ = strand('squares-g7');

export const SQUARES_G7_SKILLS: readonly CanonicalSkill[] = SQ.skills;
export const SQUARES_G7_DEPENDENCIES: readonly SkillDependency[] = SQ.dependencies;
export const SQUARES_G7_STRATEGIES: readonly InstructionalStrategy[] = SQ.strategies;
export const SQUARES_G7_MISCONCEPTIONS: readonly MisconceptionDefinition[] = SQ.misconceptions;

export function buildSquaresG7DraftGraph(): CurriculumGraph {
  return strandGraph('squares-g7');
}
