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

/** One subject's skills, so a guardian sees Math and English side by side. */
export interface SubjectGroup {
  readonly subject: string;
  readonly rows: readonly DashboardRow[];
}

export interface ParentDashboard {
  readonly learnerAlias: string;
  /** Flat view across all skills (kept for callers that don't group). */
  readonly rows: readonly DashboardRow[];
  /** Grouped by subject, subjects and rows in stable alphabetical order. */
  readonly bySubject: readonly SubjectGroup[];
}

const toRow = (p: SkillProjection): DashboardRow => ({
  skillId: p.skillId,
  standing: classifyStanding(p),
  confidence: p.confidence,
  evidenceCount: p.evidenceCount,
});

export function buildDashboard(
  learnerAlias: string,
  projections: readonly SkillProjection[],
  subjectOf: (skillId: string) => string = () => 'other',
): ParentDashboard {
  const rows = projections.map(toRow);

  const groups = new Map<string, DashboardRow[]>();
  for (const p of projections) {
    const subject = subjectOf(p.skillId);
    const bucket = groups.get(subject) ?? [];
    bucket.push(toRow(p));
    groups.set(subject, bucket);
  }
  const bySubject: SubjectGroup[] = [...groups.entries()]
    .map(([subject, rs]) => ({
      subject,
      rows: [...rs].sort((a, b) => a.skillId.localeCompare(b.skillId)),
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject));

  return { learnerAlias, rows, bySubject };
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
