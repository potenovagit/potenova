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
 *  DRAFT — Math strand: coding (algebra)
 * ============================================================================
 * Ontario Grade 1 C3.1/C3.2 (write/execute and read simple sequential programs).
 * Coached through the SELECTION interaction ("which program gets the robot to
 * the star?"), graded by a deterministic executor that runs each candidate
 * program on a small grid.
 *   SK-AL-code-sequence   choose the movement sequence that reaches the goal
 *
 * Authored as data in `strands/data/coding.json` and loaded by the shared
 * loader. DRAFT ENGINEERING FIXTURE, NOT VALIDATED CURRICULUM COVERAGE
 * (ER-03 gate).
 */

const CODE = strand('coding');

export const CODING_SKILLS: readonly CanonicalSkill[] = CODE.skills;
export const CODING_DEPENDENCIES: readonly SkillDependency[] = CODE.dependencies;
export const CODING_STRATEGIES: readonly InstructionalStrategy[] = CODE.strategies;
export const CODING_MISCONCEPTIONS: readonly MisconceptionDefinition[] = CODE.misconceptions;

export function buildCodingDraftGraph(): CurriculumGraph {
  return strandGraph('coding');
}
