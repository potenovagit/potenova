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
 *  DRAFT — Math strand: positional language (spatial sense)
 * ============================================================================
 * Ontario Grade 1 E1.4 (describe and use the relative position of objects).
 * Coached through the SELECTION interaction ("which picture shows the star
 * ABOVE the box?"), graded by a deterministic oracle that recomputes which
 * scene satisfies the target relation.
 *   SK-GEO-positional-language   pick the scene matching a position word
 *
 * The first Spatial Sense skill in the engine. Authored as data in
 * `strands/data/spatial.json` and loaded by the shared loader. DRAFT
 * ENGINEERING FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const SP = strand('spatial');

export const SPATIAL_SKILLS: readonly CanonicalSkill[] = SP.skills;
export const SPATIAL_DEPENDENCIES: readonly SkillDependency[] = SP.dependencies;
export const SPATIAL_STRATEGIES: readonly InstructionalStrategy[] = SP.strategies;
export const SPATIAL_MISCONCEPTIONS: readonly MisconceptionDefinition[] = SP.misconceptions;

export function buildSpatialDraftGraph(): CurriculumGraph {
  return strandGraph('spatial');
}
