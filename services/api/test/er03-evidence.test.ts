import { describe, it, expect } from 'vitest';
import { runEr03EvidencePack, renderEr03EvidenceReport } from '../src/er03-evidence';

/**
 * The authored conceptual probes must, as written, drive the evaluator to
 * INDEPENDENT on a fully-correct run and withhold mastery (reasoning unmet) when
 * the reasoning probe is answered with a misconception distractor — for both
 * assessed-core skills at Grades 3–5. A regression in either the probes or the
 * evaluator breaks this. Synthetic only.
 */
describe('ER-03 authored-probe evidence pack', () => {
  const report = runEr03EvidencePack();

  it('covers both assessed-core skills at Grades 3, 4 and 5 (6 groups)', () => {
    expect(report.groups).toHaveLength(6);
    const key = (g: { skillId: string; gradeTarget: number }) => `${g.skillId}@${g.gradeTarget}`;
    const keys = new Set(report.groups.map(key));
    for (const s of ['SK-FR-equiv', 'SK-FR-compare']) {
      for (const g of [3, 4, 5]) expect(keys.has(`${s}@${g}`)).toBe(true);
    }
  });

  it('every group: correct run INDEPENDENT, wrong-reasoning run NOT_YET with reasoning unmet', () => {
    const failing = report.groups.filter((g) => g.result !== 'PASS');
    expect(
      failing.map(
        (g) =>
          `${g.skillId}@${g.gradeTarget} correct=${g.correctRun.state} wrong=${g.wrongReasoningRun.state}`,
      ),
    ).toEqual([]);
    expect(report.allPass).toBe(true);
  });

  it('each correct run satisfies all four dimensions from the authored set', () => {
    for (const g of report.groups) {
      for (const d of g.correctRun.dimensions) {
        expect(d.met).toBe(true);
      }
      expect(g.correctRun.unmet).toHaveLength(0);
    }
  });

  it('the policy is surfaced as a CANDIDATE (advisory, not approved)', () => {
    expect(report.policyApproved).toBe(false);
    expect(report.policyVersion).toContain('CANDIDATE');
  });

  it('renders a filable Markdown report', () => {
    const md = renderEr03EvidenceReport(report);
    expect(md).toContain('# ER-03 conceptual-mastery evidence pack');
    expect(md).toContain('SK-FR-compare');
  });
});
