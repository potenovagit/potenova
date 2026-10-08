import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildTraceReport, assertBaselineShape } from './trace';

/**
 * CLI: potenova-trace --csv spec/requirements.csv [--out evidence/.../trace.json]
 * Exits non-zero if the baseline shape assertions fail (CI gate).
 */
function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main(): void {
  const csvPath = arg('--csv') ?? 'spec/requirements.csv';
  const outPath = arg('--out');

  const report = buildTraceReport(csvPath);
  const shapeFailures = assertBaselineShape(report);

  // eslint-disable-next-line no-console
  console.log(
    [
      `Potenova requirement trace`,
      `  source:            ${report.csvPath}`,
      `  requirements:      ${report.totalRequirements}`,
      `  domains:           ${Object.keys(report.byDomain).length}`,
      `  work packages:     ${Object.keys(report.byWorkPackage).length}`,
      `  WP-00 requirements:${report.byWorkPackage['WP-00'] ?? 0}`,
      `  LOCKED:            ${report.byState['LOCKED'] ?? 0}`,
      `  implementation:    ${Object.keys(report.implementationStatus).join(', ')}`,
      `  advisory problems: ${report.problems.length}`,
    ].join('\n'),
  );

  if (outPath) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
    // eslint-disable-next-line no-console
    console.log(`  wrote report:      ${outPath}`);
  }

  if (shapeFailures.length > 0) {
    // eslint-disable-next-line no-console
    console.error('\nBASELINE SHAPE FAILURES:\n  - ' + shapeFailures.join('\n  - '));
    process.exit(1);
  }
}

main();
