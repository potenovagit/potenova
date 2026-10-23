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
 *  DRAFT — Math strand: skip-counting to 200 (Grade 2)
 * ============================================================================
 * Ontario Grade 2 B1.4 (count to 200 by 20s, 25s and 50s). Reuses the
 * skip-count oracle with its widened step set.
 *   SK-NS-skip-count-200   give the next term of a 20s/25s/50s sequence
 *
 * Authored as data in `strands/data/skip-count-g2.json`. DRAFT ENGINEERING
 * FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const SKIP2 = strand('skip-count-g2');

export const SKIP_COUNT_G2_SKILLS: readonly CanonicalSkill[] = SKIP2.skills;
export const SKIP_COUNT_G2_DEPENDENCIES: readonly SkillDependency[] = SKIP2.dependencies;
export const SKIP_COUNT_G2_STRATEGIES: readonly InstructionalStrategy[] = SKIP2.strategies;
export const SKIP_COUNT_G2_MISCONCEPTIONS: readonly MisconceptionDefinition[] =
  SKIP2.misconceptions;

export function buildSkipCountG2DraftGraph(): CurriculumGraph {
  return strandGraph('skip-count-g2');
}
