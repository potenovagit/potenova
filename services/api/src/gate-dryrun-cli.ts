import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runGateDryRun, renderGateDryRunReport } from './gate-dryrun';

/**
 * CLI: run the Stage-2 gate dry-run and file its evidence under
 * evidence/G2/GATE-DRYRUN/<run-id>/. Synthetic only. Exits non-zero if any
 * fail-closed gate did not hold.
 *
 *   npm run gate:dryrun
 */
async function main(): Promise<void> {
  const report = await runGateDryRun();
  const outDir = join('evidence', 'G2', 'GATE-DRYRUN', report.runId);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'transcript.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(join(outDir, 'report.md'), renderGateDryRunReport(report));

  // eslint-disable-next-line no-console
  console.log(
    `Gate dry-run ${report.runId}: ${report.summary.passed}/${report.summary.total} PASS` +
      (report.allPass ? ' — all gates held' : ` — ${report.summary.failed} FAILED`),
  );
  // eslint-disable-next-line no-console
  console.log(`Evidence: ${outDir}/report.md`);
  for (const c of report.checks) {
    // eslint-disable-next-line no-console
    console.log(`  ${c.result === 'PASS' ? 'PASS' : 'FAIL'}  ${c.id}  (${c.observed})`);
  }
  if (!report.allPass) process.exitCode = 1;
}

void main();
