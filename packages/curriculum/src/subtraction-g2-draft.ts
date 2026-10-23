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
 *  DRAFT — Math strand: subtraction within 100 (Grade 2)
 * ============================================================================
 * Ontario Grade 2 B2.3 (subtract whole numbers to 100, with regrouping). Reuses
 * the G1 integer-subtraction oracle unchanged at the higher bound.
 *   SK-NS-sub-within100   subtract two-digit numbers, with regrouping
 *
 * Authored as data in `strands/data/subtraction-g2.json`. DRAFT ENGINEERING
 * FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const SUB2 = strand('subtraction-g2');

export const SUBTRACTION_G2_SKILLS: readonly CanonicalSkill[] = SUB2.skills;
export const SUBTRACTION_G2_DEPENDENCIES: readonly SkillDependency[] = SUB2.dependencies;
export const SUBTRACTION_G2_STRATEGIES: readonly InstructionalStrategy[] = SUB2.strategies;
export const SUBTRACTION_G2_MISCONCEPTIONS: readonly MisconceptionDefinition[] =
  SUB2.misconceptions;

export function buildSubtractionG2DraftGraph(): CurriculumGraph {
  return strandGraph('subtraction-g2');
}
