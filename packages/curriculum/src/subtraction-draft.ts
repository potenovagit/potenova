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
 *  DRAFT — Math strand: whole-number subtraction (number sense)
 * ============================================================================
 * The subtraction counterpart to the addition strand (Ontario Grade 1
 * B2.2/B2.3 — related subtraction facts):
 *   SK-NS-sub-within10   differences within 10 (no borrowing)      [entry]
 *   SK-NS-sub-within20   differences within 20 (crossing ten)      [depends on within10]
 *
 * Authored as data in `strands/data/subtraction.json` and loaded by the shared
 * loader; the named exports are preserved for consumers. DRAFT ENGINEERING
 * FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const SUB = strand('subtraction');

export const SUBTRACTION_SKILLS: readonly CanonicalSkill[] = SUB.skills;
export const SUBTRACTION_DEPENDENCIES: readonly SkillDependency[] = SUB.dependencies;
export const SUBTRACTION_STRATEGIES: readonly InstructionalStrategy[] = SUB.strategies;
export const SUBTRACTION_MISCONCEPTIONS: readonly MisconceptionDefinition[] = SUB.misconceptions;

export function buildSubtractionDraftGraph(): CurriculumGraph {
  return strandGraph('subtraction');
}
