#!/usr/bin/env node
/**
 * Generate the educator overlay-coverage worksheet from the catalogue + the
 * DRAFT multi-domain overlays. One row per G1–8 expectation, with any proposed
 * teachable-skill mapping (unsigned) or blank where unmapped. Deterministic.
 *
 * Output: CSV on stdout, or to the path in argv[2]. The xlsx the educators
 * receive is built from this CSV. Nothing here is validated coverage.
 */
import { writeFileSync } from 'node:fs';
import {
  buildOverlayWorksheet,
  overlayCoverage,
  allOverlayMappings,
} from '../packages/curriculum/src/index.ts';

const rows = buildOverlayWorksheet();
const header = [
  'subject',
  'grade',
  'strand',
  'overallCode',
  'sourceCode',
  'expectationId',
  'text',
  'status',
  'proposedSkillIds',
  'coverage',
  'proposedBy',
  'rationale',
  // educator-authoring columns (blank for review):
  'educator_skillIds',
  'educator_coverage',
  'educator_decision',
  'reviewer',
  'review_notes',
];
const esc = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const lines = [header.join(',')];
for (const r of rows) {
  lines.push(
    [
      r.subject,
      r.grade,
      r.strand,
      r.overallCode,
      r.sourceCode,
      r.expectationId,
      r.text,
      r.status,
      r.proposedSkillIds,
      r.coverage,
      r.proposedBy,
      r.rationale,
      '',
      '',
      '',
      '',
      '',
    ]
      .map(esc)
      .join(','),
  );
}
const csv = lines.join('\n') + '\n';
const out = process.argv[2];
if (out) writeFileSync(out, csv);
else process.stdout.write(csv);

// Summary to stderr (never pollutes the CSV).
const total = rows.length;
const proposed = rows.filter((r) => r.status === 'PROPOSED (unsigned)').length;
console.error(
  `worksheet: ${total} expectations, ${proposed} with a DRAFT proposal, ${total - proposed} unmapped; ${allOverlayMappings().length} proposals total`,
);
console.error('coverage by subject/grade:', JSON.stringify(overlayCoverage(allOverlayMappings())));
