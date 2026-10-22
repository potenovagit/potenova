#!/usr/bin/env node
/**
 * Review a FILLED educator overlay-coverage worksheet: validate the structure of
 * the educator's decisions and report authoring progress. The return trip for the
 * worksheet `build-overlay-worksheet.ts` emits.
 *
 * Structure only — it never judges whether a mapping is pedagogically correct
 * (that is the educator's, and stays unsigned until they sign it). It exits
 * non-zero if there are blocking errors, so it can gate an authoring check.
 *
 *   npm run overlay:review -- path/to/filled-worksheet.csv
 */
import { readFileSync } from 'node:fs';
import {
  parseFilledWorksheet,
  validateFilledWorksheet,
  summarizeAuthoringProgress,
} from '../packages/curriculum/src/index.ts';

const path = process.argv[2];
if (!path) {
  console.error('usage: npm run overlay:review -- path/to/filled-worksheet.csv');
  process.exit(2);
}

const rows = parseFilledWorksheet(readFileSync(path, 'utf8'));
const issues = validateFilledWorksheet(rows);
const errors = issues.filter((i) => i.severity === 'error');
const warnings = issues.filter((i) => i.severity === 'warning');
const progress = summarizeAuthoringProgress(rows);

console.log(`Overlay worksheet review — ${path}`);
console.log(
  `  rows: ${progress.total} | decided: ${progress.decided} | remaining: ${progress.remaining}`,
);
console.log(
  '  decisions: ' +
    Object.entries(progress.byDecision)
      .map(([d, n]) => `${d}=${n}`)
      .join('  '),
);
console.log('  by subject/grade:');
for (const g of progress.bySubjectGrade) {
  console.log(
    `    ${g.subject} G${g.grade}: ${g.decided}/${g.total} decided (${g.remaining} left)`,
  );
}

const show = (label: string, list: typeof issues) => {
  if (list.length === 0) return;
  console.log(`\n${label} (${list.length}):`);
  for (const i of list.slice(0, 200)) {
    console.log(`  row ${i.rowNumber} [${i.expectationId}]: ${i.message}`);
  }
  if (list.length > 200) console.log(`  … and ${list.length - 200} more`);
};
show('ERRORS', errors);
show('Warnings', warnings);

console.log(
  `\n${errors.length === 0 ? 'OK — no blocking errors.' : `FAILED — ${errors.length} error(s) to fix.`}` +
    ` ${warnings.length} warning(s).`,
);
process.exit(errors.length === 0 ? 0 : 1);
