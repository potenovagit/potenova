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
 *  DRAFT — Math strand: 2-D shapes (geometry)
 * ============================================================================
 * Ontario Grade 1 E1.1–E1.3 (identify and sort two-dimensional shapes by an
 * attribute). Coached through the SELECTION interaction ("which shape has 3
 * sides?"), graded by a deterministic oracle that counts sides.
 *   SK-GEO-shape-attribute   pick the 2-D shape with a given number of sides
 *
 * Authored as data in `strands/data/geometry.json` and loaded by the shared
 * loader. DRAFT ENGINEERING FIXTURE, NOT VALIDATED CURRICULUM COVERAGE
 * (ER-03 gate).
 */

const GEO = strand('geometry');

export const GEOMETRY_SKILLS: readonly CanonicalSkill[] = GEO.skills;
export const GEOMETRY_DEPENDENCIES: readonly SkillDependency[] = GEO.dependencies;
export const GEOMETRY_STRATEGIES: readonly InstructionalStrategy[] = GEO.strategies;
export const GEOMETRY_MISCONCEPTIONS: readonly MisconceptionDefinition[] = GEO.misconceptions;

export function buildGeometryDraftGraph(): CurriculumGraph {
  return strandGraph('geometry');
}
