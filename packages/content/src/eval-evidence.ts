import type { EvalSuiteReport } from './eval-suite';

/**
 * Evidence-artifact shape for a candidate-model evaluation run (ER-16; AI-003).
 *
 * Mirrors the evidence repository contract (07 §D): gate, requirement id, run id,
 * date, software/model/content/policy versions, synthetic fixture ids, actual vs
 * expected result, reviewer and exception slots. The report itself is the test
 * report. No child content ever appears here — the suite is synthetic.
 */
export interface EvalEvidenceArtifact {
  readonly gate: string;
  readonly requirementId: string;
  readonly runId: string;
  readonly date: string;
  readonly synthetic: true;
  readonly deliveredToChild: false;
  readonly model: string;
  readonly processingRegion: string;
  readonly versions: {
    readonly validator: string;
    readonly apiVersion?: string;
    readonly suiteSize: number;
  };
  readonly syntheticFixtureIds: readonly string[];
  readonly expected: {
    readonly containmentHeld: true;
    readonly note: string;
  };
  readonly actual: {
    readonly accuracy: number;
    readonly containmentHeld: boolean;
    readonly incorrect: number;
    readonly incorrectContained: number;
    readonly byDelivery: EvalSuiteReport['byDelivery'];
    readonly byVerdict: EvalSuiteReport['byVerdict'];
    readonly bySkill: EvalSuiteReport['bySkill'];
  };
  /** PASS only when containment held — a wrong answer reaching a child is the failure. */
  readonly result: 'PASS' | 'FAIL';
  /** Filled in by a human reviewer when the artifact is accepted toward the gate. */
  readonly reviewer: string | null;
  readonly exception: string | null;
  readonly tokenUnits: number;
  readonly report: EvalSuiteReport;
}

export interface BuildEvidenceParams {
  readonly report: EvalSuiteReport;
  readonly model: string;
  readonly processingRegion: string;
  readonly runId: string;
  readonly apiVersion?: string;
  readonly tokenUnits?: number;
  readonly gate?: string;
  readonly requirementId?: string;
}

/** A stable synthetic fixture id per task, so the evidence cites what ran. */
function fixtureId(report: EvalSuiteReport, index: number): string {
  const item = report.items[index];
  const slug = item.label.replace(/[^0-9a-zA-Z]+/g, '-').replace(/^-+|-+$/g, '');
  return `SYN-${item.kind.toUpperCase()}-${slug}`;
}

export function buildEvalEvidence(params: BuildEvidenceParams): EvalEvidenceArtifact {
  const { report } = params;
  return {
    gate: params.gate ?? 'G2',
    requirementId: params.requirementId ?? 'AI-003',
    runId: params.runId,
    date: report.generatedAt,
    synthetic: true,
    deliveredToChild: false,
    model: params.model,
    processingRegion: params.processingRegion,
    versions: {
      validator: `${report.validatorId}@${report.validatorVersion}`,
      apiVersion: params.apiVersion,
      suiteSize: report.total,
    },
    syntheticFixtureIds: report.items.map((_, i) => fixtureId(report, i)),
    expected: {
      containmentHeld: true,
      note: 'Every incorrect candidate answer must be contained (FALLBACK/BLOCK), never delivered.',
    },
    actual: {
      accuracy: report.accuracy,
      containmentHeld: report.containmentHeld,
      incorrect: report.incorrect,
      incorrectContained: report.incorrectContained,
      byDelivery: report.byDelivery,
      byVerdict: report.byVerdict,
      bySkill: report.bySkill,
    },
    result: report.containmentHeld ? 'PASS' : 'FAIL',
    reviewer: null,
    exception: null,
    tokenUnits: params.tokenUnits ?? 0,
    report,
  };
}

/** Human-readable companion to the JSON artifact. */
export function renderEvalEvidenceMarkdown(a: EvalEvidenceArtifact): string {
  const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;
  const lines = [
    `# Model evaluation — ${a.requirementId} (${a.gate})`,
    '',
    `- Run: \`${a.runId}\`  ·  Date: ${a.date}`,
    `- Model: \`${a.model}\`  ·  Region: ${a.processingRegion}  ·  Validator: ${a.versions.validator}`,
    `- Synthetic data only; delivered to a child: **no**.`,
    `- Result: **${a.result}**  (containment ${a.actual.containmentHeld ? 'held' : 'FAILED'})`,
    '',
    '## Scores',
    `- Accuracy: ${pct(a.actual.accuracy)} (${a.report.correct}/${a.report.total})`,
    `- By skill: comparison ${a.actual.bySkill.comparison.correct}/${a.actual.bySkill.comparison.total} · equivalence ${a.actual.bySkill.equivalence.correct}/${a.actual.bySkill.equivalence.total}`,
    `- Incorrect answers: ${a.actual.incorrect} — contained: ${a.actual.incorrectContained}`,
    `- Delivery: DELIVER ${a.actual.byDelivery.DELIVER} · FALLBACK ${a.actual.byDelivery.FALLBACK} · BLOCK ${a.actual.byDelivery.BLOCK}`,
    `- Verdicts: PASS ${a.actual.byVerdict.PASS} · FAIL ${a.actual.byVerdict.FAIL} · UNCERTAIN ${a.actual.byVerdict.UNCERTAIN} · UNAVAILABLE ${a.actual.byVerdict.UNAVAILABLE}`,
    `- Tokens: ${a.tokenUnits}`,
    '',
    '## Review',
    `- Reviewer: ${a.reviewer ?? '_(unsigned — pending human review)_'}`,
    `- Exception/risk: ${a.exception ?? 'none'}`,
    '',
    '> Expected: ' + a.expected.note,
  ];
  return lines.join('\n') + '\n';
}
