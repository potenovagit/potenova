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
 *  DRAFT — English vertical-slice strand: word formation (plurals / past / comparative)
 * ============================================================================
 * A second subject so the engine (content gate, evidence, planner, stall,
 * mastery) is exercised on something other than Math, with the SAME adaptive
 * remediation → advancement loop:
 *   SK-EN-plural-base      add -s (dog→dogs)                    [entry]
 *   SK-EN-plural-sibilant  -es / consonant-y→ies (box→boxes)    [depends on base]
 *
 * Authored as data in `strands/data/english.json` and loaded by the shared
 * loader; the named exports are preserved for consumers. THIS IS A DRAFT
 * ENGINEERING FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (not mapped to official
 * Language expectations; the curriculum gate / ER-03 signs real coverage).
 */

const EN = strand('english');

export const ENGLISH_SKILLS: readonly CanonicalSkill[] = EN.skills;
export const ENGLISH_DEPENDENCIES: readonly SkillDependency[] = EN.dependencies;
export const ENGLISH_STRATEGIES: readonly InstructionalStrategy[] = EN.strategies;
export const ENGLISH_MISCONCEPTIONS: readonly MisconceptionDefinition[] = EN.misconceptions;

export function buildEnglishDraftGraph(): CurriculumGraph {
  return strandGraph('english');
}
