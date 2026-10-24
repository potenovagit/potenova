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
 *  DRAFT — Math strand: parallelogram & triangle area (Grade 5, Measurement)
 * ============================================================================
 * Ontario Grade 5 E / exp 43 (rule-decidable slice — area of a parallelogram
 * and a triangle):
 *   SK-ME-parallelogram-area   area = base × height
 *   SK-ME-triangle-area        area = base × height ÷ 2
 *
 * Extends the Measurement strand begun at Grade 4 (rectangle area) with the
 * `parallelogram_area` / `triangle_area` oracles. Triangle items are restricted
 * to an even base × height so the answer is a whole number (float-free).
 * Authored as data in `strands/data/area-g5.json`. DRAFT ENGINEERING FIXTURE,
 * NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const AR = strand('area-g5');

export const AREA_G5_SKILLS: readonly CanonicalSkill[] = AR.skills;
export const AREA_G5_DEPENDENCIES: readonly SkillDependency[] = AR.dependencies;
export const AREA_G5_STRATEGIES: readonly InstructionalStrategy[] = AR.strategies;
export const AREA_G5_MISCONCEPTIONS: readonly MisconceptionDefinition[] = AR.misconceptions;

export function buildAreaG5DraftGraph(): CurriculumGraph {
  return strandGraph('area-g5');
}
