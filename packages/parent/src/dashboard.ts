import { classifyStanding, type SkillStanding } from '@potenova/diagnostic';
import type { SkillProjection } from '@potenova/learner-state';

/**
 * Parent dashboard (PAR-001/002/010/016; AT-56 adjacent).
 *
 * Shows demonstrated mastery/confidence by skill with parent-friendly standings.
 * It NEVER substitutes a predictive report-card grade for skill evidence
 * (PAR-001) — the row type has no grade field at all. "Why this today?" exposes
 * only a structured reason code, never raw internal chain-of-thought (PAR-016).
 */

export interface DashboardRow {
  readonly skillId: string;
  readonly standing: SkillStanding;
  readonly confidence: number;
  readonly evidenceCount: number;
}

export interface ParentDashboard {
  readonly learnerAlias: string;
  readonly rows: readonly DashboardRow[];
}

export function buildDashboard(
  learnerAlias: string,
  projections: readonly SkillProjection[],
): ParentDashboard {
  const rows = projections.map(
    (p): DashboardRow => ({
      skillId: p.skillId,
      standing: classifyStanding(p),
      confidence: p.confidence,
      evidenceCount: p.evidenceCount,
    }),
  );
  return { learnerAlias, rows };
}

export interface WhyThisToday {
  readonly reasonCode: string;
  /** Invariant (PAR-016): no raw internal chain-of-thought is ever exposed/stored. */
  readonly exposesChainOfThought: false;
}

/** PAR-016: the "Why this today?" explanation is the structured reason code only. */
export function whyThisToday(reasonCode: string): WhyThisToday {
  return { reasonCode, exposesChainOfThought: false };
}
