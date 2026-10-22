import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  parseFilledWorksheet,
  validateFilledWorksheet,
  summarizeAuthoringProgress,
  catalogueExpectationIds,
  buildScaffoldedWorksheet,
  buildOverlayWorksheet,
  allOverlaySkills,
} from '@potenova/curriculum';

/**
 * The educator worksheet RETURN trip: parse a filled worksheet, validate the
 * structure of the educator's decisions, and report progress. Structure only —
 * never pedagogy.
 */

const HEADER = [
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
  'educator_skillIds',
  'educator_coverage',
  'educator_decision',
  'reviewer',
  'review_notes',
];

const esc = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Build a CSV from the header and a list of {col: value} rows (missing cols blank). */
function csv(rows: Array<Record<string, string>>): string {
  const lines = [HEADER.join(',')];
  for (const r of rows) lines.push(HEADER.map((h) => esc(r[h] ?? '')).join(','));
  return lines.join('\n') + '\n';
}

const EXP = buildOverlayWorksheet()[0]!.expectationId; // a real catalogue expectation
const SKILL = allOverlaySkills()[0]!.skillId; // a real teachable skill id

describe('CSV parsing', () => {
  it('handles quoted commas, newlines and doubled quotes', () => {
    const table = parseCsv('a,b\n"x,y","line1\nline2"\n"he said ""hi""",z\n');
    expect(table).toEqual([
      ['a', 'b'],
      ['x,y', 'line1\nline2'],
      ['he said "hi"', 'z'],
    ]);
  });
});

describe('parse + validate a filled worksheet', () => {
  it('a freshly generated (all-blank) worksheet is valid with zero decided', () => {
    const rows = buildOverlayWorksheet();
    const body = csv(
      rows.map((r) => ({
        subject: r.subject,
        grade: String(r.grade),
        strand: r.strand,
        overallCode: r.overallCode,
        sourceCode: r.sourceCode,
        expectationId: r.expectationId,
        text: r.text,
        status: r.status,
        proposedSkillIds: r.proposedSkillIds,
      })),
    );
    const parsed = parseFilledWorksheet(body);
    expect(parsed.length).toBe(rows.length);
    const issues = validateFilledWorksheet(parsed);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    const progress = summarizeAuthoringProgress(parsed);
    expect(progress.decided).toBe(0);
    expect(progress.remaining).toBe(progress.total);
  });

  it('throws if a required column is missing', () => {
    expect(() => parseFilledWorksheet('subject,grade\nmath,3\n')).toThrow(/missing/);
  });

  it('accepts a well-formed CONFIRM and counts it as decided', () => {
    const body = csv([
      {
        subject: 'math',
        grade: '3',
        expectationId: EXP,
        sourceCode: 'B1.1',
        proposedSkillIds: SKILL,
        educator_skillIds: SKILL,
        educator_coverage: 'full',
        educator_decision: 'CONFIRM',
        reviewer: 'EdU',
      },
    ]);
    const rows = parseFilledWorksheet(body);
    expect(validateFilledWorksheet(rows).filter((i) => i.severity === 'error')).toEqual([]);
    const p = summarizeAuthoringProgress(rows);
    expect(p.decided).toBe(1);
    expect(p.byDecision.CONFIRM).toBe(1);
  });
});

describe('validator error classes', () => {
  const run = (row: Record<string, string>) =>
    validateFilledWorksheet(
      parseFilledWorksheet(csv([{ subject: 'math', grade: '3', sourceCode: 'B1.1', ...row }])),
    );
  const errs = (row: Record<string, string>) =>
    run(row)
      .filter((i) => i.severity === 'error')
      .map((i) => i.message);

  it('flags an expectationId not in the catalogue', () => {
    expect(
      errs({
        expectationId: 'EXP-ONT-MATH-G3-Z9.9',
        educator_decision: 'REJECT',
        reviewer: 'E',
      }).join(' '),
    ).toMatch(/not in the G1–8 catalogue/);
  });

  it('flags an unknown decision value', () => {
    expect(
      errs({ expectationId: EXP, educator_decision: 'MAYBE', reviewer: 'E' }).join(' '),
    ).toMatch(/not one of/);
  });

  it('requires a reviewer for any decision', () => {
    expect(
      errs({
        expectationId: EXP,
        educator_skillIds: SKILL,
        educator_coverage: 'full',
        educator_decision: 'CONFIRM',
      }).join(' '),
    ).toMatch(/needs a reviewer/);
  });

  it('requires coverage and a skill for CONFIRM/REVISE', () => {
    const e = errs({ expectationId: EXP, educator_decision: 'REVISE', reviewer: 'E' }).join(' ');
    expect(e).toMatch(/requires at least one skill/);
    expect(e).toMatch(/requires educator_coverage/);
  });

  it('forbids skills on REJECT/NONE', () => {
    expect(
      errs({
        expectationId: EXP,
        educator_skillIds: SKILL,
        educator_decision: 'REJECT',
        reviewer: 'E',
      }).join(' '),
    ).toMatch(/must not list any skills/);
  });

  it('rejects a malformed skill token', () => {
    expect(
      errs({
        expectationId: EXP,
        educator_skillIds: 'banana',
        educator_coverage: 'full',
        educator_decision: 'REVISE',
        reviewer: 'E',
      }).join(' '),
    ).toMatch(/not a valid skill id/);
  });

  it('flags duplicate rows for the same expectation', () => {
    const body = csv([
      { expectationId: EXP, educator_decision: 'REJECT', reviewer: 'E' },
      { expectationId: EXP, educator_decision: 'REJECT', reviewer: 'E' },
    ]);
    expect(
      validateFilledWorksheet(parseFilledWorksheet(body))
        .filter((i) => i.severity === 'error')
        .map((i) => i.message)
        .join(' '),
    ).toMatch(/duplicate row/);
  });

  it('warns (not errors) on an unknown skill id and on CONFIRM that changes the proposal', () => {
    const w = run({
      expectationId: EXP,
      proposedSkillIds: SKILL,
      educator_skillIds: 'SK-GHOST-1',
      educator_coverage: 'full',
      educator_decision: 'CONFIRM',
      reviewer: 'E',
    });
    expect(
      w.some((i) => i.severity === 'warning' && /not a known teachable skill/.test(i.message)),
    ).toBe(true);
    expect(
      w.some((i) => i.severity === 'warning' && /differ from the proposal/.test(i.message)),
    ).toBe(true);
    expect(w.filter((i) => i.severity === 'error')).toEqual([]);
  });
});

describe('catalogue + scaffolding', () => {
  it('the catalogue id set matches the worksheet row count (full G1–8 scope)', () => {
    const ids = catalogueExpectationIds();
    expect(ids.size).toBe(buildOverlayWorksheet().length);
    expect(ids.size).toBeGreaterThan(800);
  });

  it('scaffolding surfaces nearby already-proposed skills under the same overall code', () => {
    const scaffolded = buildScaffoldedWorksheet();
    // At least one proposed row has sibling skills proposed under its overall code
    // (the fractions overlay maps several skills to Number expectations).
    const withNearby = scaffolded.filter((r) => r.proposedSkillIds && r.nearbySkillIds);
    expect(withNearby.length).toBeGreaterThan(0);
    // A row never lists itself as "nearby".
    for (const r of scaffolded) {
      const own = new Set(
        r.proposedSkillIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      );
      for (const n of r.nearbySkillIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)) {
        expect(own.has(n)).toBe(false);
      }
    }
  });
});
