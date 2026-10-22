import { CONCEPTUAL_PROBES, scoreProbe, type ConceptualProbe } from '@potenova/content';
import {
  evaluateAssessedCoreMastery,
  ER03_CANDIDATE_V02,
  type ConceptualEvidence,
  type ConceptualMasteryResult,
} from '@potenova/learner-state';

/**
 * ER-03 evidence pack (Stage-1/2, synthetic) — drives the AUTHORED conceptual
 * probes (packages/content/conceptual-probes.ts) through the SAME scorer and
 * evaluator the running system uses, for BOTH assessed-core skills (equivalence
 * and comparison) at Grades 3, 4 and 5.
 *
 * For each (skill, grade) it runs two synthetic learners over the authored probe
 * set:
 *   - a CORRECT run (every probe answered with its correct option) → must reach
 *     INDEPENDENT; and
 *   - a WRONG-REASONING run (the reasoning probe answered with a misconception
 *     distractor, everything else correct) → must stay NOT_YET_DEMONSTRATED with
 *     the reasoning dimension unmet — the property the educator asked to see.
 *
 * This ties the authored content to the gate: it proves the probes as written
 * exercise all four dimensions and that a right final answer with wrong reasoning
 * does not earn mastery. CANDIDATE policy, synthetic data only — no child, no
 * model; probe correctness comes from `scoreProbe`, so the content's own answer
 * keys drive the evidence.
 */

export interface Er03RunOutcome {
  readonly state: ConceptualMasteryResult['state'];
  readonly dimensions: ConceptualMasteryResult['dimensions'];
  readonly unmet: readonly string[];
}

export interface Er03GroupResult {
  readonly skillId: string;
  readonly gradeTarget: number;
  readonly probeCount: number;
  readonly sourceExpectationCodes: readonly string[];
  readonly correctRun: Er03RunOutcome;
  readonly wrongReasoningRun: Er03RunOutcome;
  /** PASS when the correct run is INDEPENDENT and the wrong-reasoning run is
   *  NOT_YET with reasoning unmet. */
  readonly result: 'PASS' | 'FAIL';
  /** The raw synthetic events for the correct run — the reproducible record. */
  readonly correctEvents: readonly ConceptualEvidence[];
}

export interface Er03EvidenceReport {
  readonly runId: string;
  readonly at: string;
  readonly policyVersion: string;
  readonly policyApproved: boolean;
  readonly dataset: 'synthetic';
  readonly groups: readonly Er03GroupResult[];
  readonly summary: { readonly total: number; readonly passed: number; readonly failed: number };
  readonly allPass: boolean;
}

const ASSESSED_CORE = ['SK-FR-equiv', 'SK-FR-compare'] as const;
const GRADES = [3, 4, 5] as const;

/** Build one synthetic learner's events from an authored probe set. Model + one
 *  value land in session 1 (day 1); the rest in session 2 (day 2), so the ≥2
 *  session requirement is met and the completing event is on day 2. */
function buildEvents(
  probes: readonly ConceptualProbe[],
  reasoningWrong: boolean,
): ConceptualEvidence[] {
  const model = probes.find((p) => p.dimension === 'model');
  const firstValue = probes.find((p) => p.dimension === 'value');
  const session1 = new Set<string>(
    [model?.probeId, firstValue?.probeId].filter((x): x is string => !!x),
  );
  return probes.map((p) => {
    const inS1 = session1.has(p.probeId);
    const wrong = reasoningWrong && p.dimension === 'reasoning';
    const correctOpt = p.options.find((o) => o.correct)!;
    const distractor = p.options.find((o) => !o.correct)!;
    const chosen = wrong ? distractor.id : correctOpt.id;
    const score = scoreProbe(p, chosen); // content's own answer key drives correctness
    return {
      eventId: p.probeId + (wrong ? ':wrong' : ''),
      skillId: p.skillId,
      gradeTarget: p.gradeTarget,
      dimension: p.dimension,
      correct: score.correct,
      assistanceBand: 'A0',
      mode: p.dimension === 'transfer' ? 'transfer_check' : 'independent_check',
      representation: p.representation,
      itemFamilyId: p.itemFamilyId,
      sessionId: inS1 ? 's1' : 's2',
      observedAt: inS1 ? '2026-10-01T10:00:00Z' : '2026-10-02T10:00:00Z',
    };
  });
}

const outcome = (r: ConceptualMasteryResult): Er03RunOutcome => ({
  state: r.state,
  dimensions: r.dimensions,
  unmet: r.unmet,
});

export function runEr03EvidencePack(): Er03EvidenceReport {
  const groups: Er03GroupResult[] = [];
  for (const skillId of ASSESSED_CORE) {
    const policy = ER03_CANDIDATE_V02.skills[skillId]!;
    for (const gradeTarget of GRADES) {
      const probes = CONCEPTUAL_PROBES.filter(
        (p) => p.skillId === skillId && p.gradeTarget === gradeTarget,
      );
      const correctEvents = buildEvents(probes, false);
      const wrongEvents = buildEvents(probes, true);
      const correct = evaluateAssessedCoreMastery(correctEvents, policy, gradeTarget);
      const wrong = evaluateAssessedCoreMastery(wrongEvents, policy, gradeTarget);
      const reasoningUnmet = wrong.unmet.some((u) => u.startsWith('reasoning'));
      const result =
        correct.state === 'INDEPENDENT' && wrong.state === 'NOT_YET_DEMONSTRATED' && reasoningUnmet
          ? 'PASS'
          : 'FAIL';
      groups.push({
        skillId,
        gradeTarget,
        probeCount: probes.length,
        sourceExpectationCodes: [...new Set(probes.map((p) => p.sourceExpectationCode))],
        correctRun: outcome(correct),
        wrongReasoningRun: outcome(wrong),
        result,
        correctEvents,
      });
    }
  }
  const passed = groups.filter((g) => g.result === 'PASS').length;
  return {
    runId: `er03-${Date.now()}`,
    at: new Date().toISOString(),
    policyVersion: ER03_CANDIDATE_V02.policyVersion,
    policyApproved: ER03_CANDIDATE_V02.approved,
    dataset: 'synthetic',
    groups,
    summary: { total: groups.length, passed, failed: groups.length - passed },
    allPass: passed === groups.length,
  };
}

/** Render a filable Markdown evidence report. */
export function renderEr03EvidenceReport(r: Er03EvidenceReport): string {
  const rows = r.groups
    .map((g) => {
      const dims = g.correctRun.dimensions
        .map((d) => `${d.dimension} ${d.have}/${d.need}`)
        .join('; ');
      return `| ${g.result === 'PASS' ? '✅' : '❌'} | ${g.skillId} | G${g.gradeTarget} | ${g.sourceExpectationCodes.join(', ')} | ${g.probeCount} | ${g.correctRun.state} | ${g.wrongReasoningRun.state} | ${dims} |`;
    })
    .join('\n');
  return `# ER-03 conceptual-mastery evidence pack — ${r.runId}

- **When:** ${r.at}
- **Policy:** \`${r.policyVersion}\` (approved: ${r.policyApproved} — CANDIDATE, advisory)
- **Dataset:** ${r.dataset} (no child, no model; correctness from the content's own answer keys)
- **Result:** ${r.summary.passed}/${r.summary.total} PASS${r.allPass ? ' — the gate holds for every authored (skill × grade) set' : ` — ${r.summary.failed} FAILED`}

Each authored probe set is run twice: a CORRECT run (every probe answered correctly → expect INDEPENDENT) and a WRONG-REASONING run (the reasoning probe answered with a misconception distractor, all else correct → expect NOT_YET_DEMONSTRATED with the reasoning dimension unmet). This is the property the educator asked to see — a correct final answer with wrong reasoning does not earn conceptual mastery — demonstrated over the probes **as authored**, for both assessed-core skills at Grades 3–5.

| | Skill | Grade | Ontario code(s) | Probes | Correct run | Wrong-reasoning run | Dimensions (correct run) |
|---|-------|-------|-----------------|--------|-------------|---------------------|--------------------------|
${rows}

Raw synthetic events for every correct run are in \`evidence.json\` alongside this file — each event is deterministic and reproducible via \`npm run er03:evidence\`.
`;
}
