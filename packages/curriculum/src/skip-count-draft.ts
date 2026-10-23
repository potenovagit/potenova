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
 *  DRAFT — Math strand: skip-counting to 50 (number sense)
 * ============================================================================
 * Ontario Grade 1 B1.5 (count to 50 by 1s, 2s, 5s and 10s):
 *   SK-NS-skip-count-50   give the next term of a skip-count sequence   [single skill]
 *
 * Authored as data in `strands/data/skip-count.json` and loaded by the shared
 * loader; the named exports are preserved for consumers. DRAFT ENGINEERING
 * FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const SKIP = strand('skip-count');

export const SKIP_COUNT_SKILLS: readonly CanonicalSkill[] = SKIP.skills;
export const SKIP_COUNT_DEPENDENCIES: readonly SkillDependency[] = SKIP.dependencies;
export const SKIP_COUNT_STRATEGIES: readonly InstructionalStrategy[] = SKIP.strategies;
export const SKIP_COUNT_MISCONCEPTIONS: readonly MisconceptionDefinition[] = SKIP.misconceptions;

export function buildSkipCountDraftGraph(): CurriculumGraph {
  return strandGraph('skip-count');
}
