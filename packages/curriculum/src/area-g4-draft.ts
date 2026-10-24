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
 *  DRAFT — Math strand: rectangle area (Grade 4, Measurement)
 * ============================================================================
 * Ontario Grade 4 E / exp 41, 42 (rule-decidable slice — area of a rectangle,
 * and an unknown side from the area):
 *   SK-ME-rect-area          area = length × width
 *   SK-ME-rect-missing-side  unknown side = area ÷ known side
 *
 * The first Measurement strand in the engine. Computed by the deterministic
 * `rectangle_area` / `rectangle_missing_side` oracles and graded without a
 * model. Authored as data in `strands/data/area-g4.json`. DRAFT ENGINEERING
 * FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const AR = strand('area-g4');

export const AREA_G4_SKILLS: readonly CanonicalSkill[] = AR.skills;
export const AREA_G4_DEPENDENCIES: readonly SkillDependency[] = AR.dependencies;
export const AREA_G4_STRATEGIES: readonly InstructionalStrategy[] = AR.strategies;
export const AREA_G4_MISCONCEPTIONS: readonly MisconceptionDefinition[] = AR.misconceptions;

export function buildAreaG4DraftGraph(): CurriculumGraph {
  return strandGraph('area-g4');
}
