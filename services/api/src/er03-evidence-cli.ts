import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runEr03EvidencePack, renderEr03EvidenceReport } from './er03-evidence';

/**
 * CLI: run the ER-03 authored-probe evidence pack and file it under
 * evidence/G2/ER-03/<run-id>/ (report.md + evidence.json with the raw synthetic
 * events). Synthetic only. Exits non-zero if the gate did not hold for any
 * authored (skill × grade) set.
 *
 *   npm run er03:evidence
 */
function main(): void {
  const report = runEr03EvidencePack();
  const outDir = join('evidence', 'G2', 'ER-03', report.runId);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'evidence.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(join(outDir, 'report.md'), renderEr03EvidenceReport(report));

  // eslint-disable-next-line no-console
  console.log(
    `ER-03 evidence ${report.runId}: ${report.summary.passed}/${report.summary.total} PASS` +
      (report.allPass
        ? ' — gate holds for every authored set'
        : ` — ${report.summary.failed} FAILED`),
  );
  // eslint-disable-next-line no-console
  console.log(`Evidence: ${outDir}/report.md`);
  for (const g of report.groups) {
    // eslint-disable-next-line no-console
    console.log(
      `  ${g.result}  ${g.skillId} G${g.gradeTarget}  correct=${g.correctRun.state} wrong-reasoning=${g.wrongReasoningRun.state}`,
    );
  }
  if (!report.allPass) process.exitCode = 1;
}

main();
