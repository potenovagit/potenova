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
 *  DRAFT — Math strand: calendar / days of the week (time)
 * ============================================================================
 * Ontario Grade 1 E2.3 (rule-decidable slice — read and use a calendar: name
 * the day before/after a given weekday). A typed-answer skill graded by a
 * deterministic oracle over the weekly cycle.
 *   SK-TIME-calendar-day   name the day a given number of days from another
 *
 * The first Time/Measurement skill in the engine. Authored as data in
 * `strands/data/calendar.json` and loaded by the shared loader. DRAFT
 * ENGINEERING FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const CAL = strand('calendar');

export const CALENDAR_SKILLS: readonly CanonicalSkill[] = CAL.skills;
export const CALENDAR_DEPENDENCIES: readonly SkillDependency[] = CAL.dependencies;
export const CALENDAR_STRATEGIES: readonly InstructionalStrategy[] = CAL.strategies;
export const CALENDAR_MISCONCEPTIONS: readonly MisconceptionDefinition[] = CAL.misconceptions;

export function buildCalendarDraftGraph(): CurriculumGraph {
  return strandGraph('calendar');
}
