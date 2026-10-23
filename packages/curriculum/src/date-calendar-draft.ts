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
 *  DRAFT — Math strand: date arithmetic across months (time)
 * ============================================================================
 * Ontario Grade 1 E2.3 (fuller calendar slice — find the date a few days from a
 * given date, across month boundaries). Coached through the SELECTION
 * interaction over a real date model (month lengths, leap years, rollover).
 *   SK-TIME-date-offset   pick the date a given number of days from another
 *
 * Complements the day-of-week calendar skill. Authored as data in
 * `strands/data/date-calendar.json`. DRAFT ENGINEERING FIXTURE, NOT VALIDATED
 * CURRICULUM COVERAGE (ER-03 gate).
 */

const DC = strand('date-calendar');

export const DATE_CALENDAR_SKILLS: readonly CanonicalSkill[] = DC.skills;
export const DATE_CALENDAR_DEPENDENCIES: readonly SkillDependency[] = DC.dependencies;
export const DATE_CALENDAR_STRATEGIES: readonly InstructionalStrategy[] = DC.strategies;
export const DATE_CALENDAR_MISCONCEPTIONS: readonly MisconceptionDefinition[] = DC.misconceptions;

export function buildDateCalendarDraftGraph(): CurriculumGraph {
  return strandGraph('date-calendar');
}
