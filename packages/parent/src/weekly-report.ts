import { DomainError } from '@potenova/contracts';

/**
 * Weekly progress report (PAR-002/003; AT-32).
 *
 * Facts, interpretation and recommendation are kept in SEPARATE sections; the
 * report cites observed evidence and notes uncertainty, with no sensational
 * claims and — critically — no fabricated school-grade prediction. A predicted
 * grade is not an allowed item kind; the guard refuses one if a caller tries.
 */

export const REPORT_ITEM_KINDS = ['observed_evidence', 'interpretation', 'recommendation'] as const;
export type ReportItemKind = (typeof REPORT_ITEM_KINDS)[number];

export interface ReportItem {
  readonly kind: ReportItemKind;
  readonly text: string;
}

/** Loosely-typed input so a forbidden kind can be rejected at runtime, not just by types. */
export interface RawReportItem {
  readonly kind: string;
  readonly text: string;
}

export interface WeeklyReport {
  readonly learnerAlias: string;
  readonly facts: readonly ReportItem[];
  readonly interpretation: readonly ReportItem[];
  readonly recommendation: readonly ReportItem[];
  /** Explicit uncertainty note (PAR-003). */
  readonly uncertaintyNote: string;
}

/**
 * Assemble a weekly report, routing each item into its section by kind.
 *
 * @throws DomainError POLICY_BLOCKED — a forbidden item kind (e.g. a fabricated
 *         grade prediction) was supplied.
 */
export function buildWeeklyReport(
  learnerAlias: string,
  items: readonly RawReportItem[],
  uncertaintyNote: string,
): WeeklyReport {
  const allowed = REPORT_ITEM_KINDS as readonly string[];
  for (const item of items) {
    if (!allowed.includes(item.kind)) {
      throw new DomainError(
        'POLICY_BLOCKED',
        `weekly report may not contain a '${item.kind}' item (no grade prediction / sensational claim)`,
      );
    }
  }
  const typed = items as readonly ReportItem[];
  return {
    learnerAlias,
    facts: typed.filter((i) => i.kind === 'observed_evidence'),
    interpretation: typed.filter((i) => i.kind === 'interpretation'),
    recommendation: typed.filter((i) => i.kind === 'recommendation'),
    uncertaintyNote,
  };
}
