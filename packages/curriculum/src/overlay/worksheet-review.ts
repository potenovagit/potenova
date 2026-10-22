import { buildOverlayWorksheet, type OverlayWorksheetRow } from './index';
import { allOverlaySkills } from './index';

/**
 * Educator authoring support for the overlay-coverage worksheet (NFR-10; ADR-0023
 * / ADR-0032). The generator (`buildOverlayWorksheet`) emits one row per Ontario
 * G1–8 expectation for an educator to author; this module is the RETURN trip:
 * parse a filled worksheet, VALIDATE the educator's decisions, and report
 * authoring PROGRESS — so the human authoring loop has deterministic feedback.
 *
 * It judges STRUCTURE, never pedagogy: it checks that decisions are well-formed,
 * signed, and reference real expectations/skills — it never decides whether a
 * mapping is pedagogically correct (that is the educator's, and stays unsigned
 * until they sign it, LRN-007). Nothing here promotes a mapping or sets coverage.
 */

/** The five authoring decisions an educator records per expectation. */
export const EDUCATOR_DECISIONS = ['CONFIRM', 'REVISE', 'REJECT', 'AUTHOR', 'NONE'] as const;
export type EducatorDecision = (typeof EDUCATOR_DECISIONS)[number];
export const EDUCATOR_COVERAGES = ['full', 'partial'] as const;

/** A sentinel skill token an educator may use instead of a real skill id. */
const SKILL_TOKEN_NONE = 'NONE';
const NEW_SKILL_PREFIX = 'NEW-SKILL';
/** A real teachable-skill id looks like SK-… (the convention used everywhere). */
const SKILL_ID_RE = /^SK-[A-Za-z0-9-]+$/;

export interface FilledWorksheetRow {
  readonly rowNumber: number; // 1-based data row (after the header), for messages
  readonly expectationId: string;
  readonly subject: string;
  readonly grade: number;
  readonly strand: string;
  readonly sourceCode: string;
  readonly proposedSkillIds: string; // system suggestion, for CONFIRM comparison
  readonly educatorSkillIds: string;
  readonly educatorCoverage: string;
  readonly educatorDecision: string;
  readonly reviewer: string;
  readonly reviewNotes: string;
}

export interface ReviewIssue {
  readonly rowNumber: number;
  readonly expectationId: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
}

export interface AuthoringProgress {
  readonly total: number;
  readonly decided: number;
  readonly remaining: number;
  readonly byDecision: Readonly<Record<string, number>>;
  readonly bySubjectGrade: ReadonlyArray<{
    readonly subject: string;
    readonly grade: number;
    readonly total: number;
    readonly decided: number;
    readonly remaining: number;
  }>;
}

/* ---------- CSV parsing (RFC-4180-ish: quotes, escaped quotes, newlines) ------ */

/** Parse CSV text into rows of string cells. Handles quoted fields containing
 *  commas, newlines and doubled quotes. Pure. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      // Skip blank trailing line.
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}

const REQUIRED_HEADERS = [
  'subject',
  'grade',
  'strand',
  'sourceCode',
  'expectationId',
  'educator_skillIds',
  'educator_coverage',
  'educator_decision',
  'reviewer',
] as const;

/** Parse a filled worksheet CSV into typed rows, by header name (column order
 *  independent). Throws if a required column is missing. */
export function parseFilledWorksheet(csv: string): FilledWorksheetRow[] {
  const table = parseCsv(csv);
  if (table.length === 0) return [];
  const header = table[0]!.map((h) => h.trim());
  const col = (name: string): number => header.indexOf(name);
  for (const h of REQUIRED_HEADERS) {
    if (col(h) < 0) throw new Error(`worksheet is missing the "${h}" column`);
  }
  const at = (cells: string[], name: string): string => (cells[col(name)] ?? '').trim();
  const out: FilledWorksheetRow[] = [];
  for (let i = 1; i < table.length; i++) {
    const cells = table[i]!;
    out.push({
      rowNumber: i,
      expectationId: at(cells, 'expectationId'),
      subject: at(cells, 'subject'),
      grade: Number(at(cells, 'grade')),
      strand: at(cells, 'strand'),
      sourceCode: at(cells, 'sourceCode'),
      proposedSkillIds: col('proposedSkillIds') >= 0 ? at(cells, 'proposedSkillIds') : '',
      educatorSkillIds: at(cells, 'educator_skillIds'),
      educatorCoverage: at(cells, 'educator_coverage'),
      educatorDecision: at(cells, 'educator_decision').toUpperCase(),
      reviewer: at(cells, 'reviewer'),
      reviewNotes: col('review_notes') >= 0 ? at(cells, 'review_notes') : '',
    });
  }
  return out;
}

/** Split an educator skill-id cell into tokens (comma or semicolon separated). */
function skillTokens(raw: string): string[] {
  return raw
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const isNewSkillToken = (t: string): boolean =>
  t.toUpperCase() === NEW_SKILL_PREFIX || t.toUpperCase().startsWith(NEW_SKILL_PREFIX + ':');

/**
 * Validate a filled worksheet's STRUCTURE. Returns issues (errors block a clean
 * import; warnings are advisories). Pure; takes the catalogue + known skill ids
 * so it can flag stray expectations and likely skill-id typos.
 */
export function validateFilledWorksheet(
  rows: readonly FilledWorksheetRow[],
  opts: {
    readonly catalogueExpectationIds?: ReadonlySet<string>;
    readonly knownSkillIds?: ReadonlySet<string>;
  } = {},
): ReviewIssue[] {
  const catalogue = opts.catalogueExpectationIds ?? catalogueExpectationIds();
  const known = opts.knownSkillIds ?? new Set(allOverlaySkills().map((s) => s.skillId));
  const issues: ReviewIssue[] = [];
  const seen = new Map<string, number>();
  const add = (r: FilledWorksheetRow, severity: 'error' | 'warning', message: string) =>
    issues.push({ rowNumber: r.rowNumber, expectationId: r.expectationId, severity, message });

  for (const r of rows) {
    // Every row must target a real catalogue expectation.
    if (!r.expectationId) {
      add(r, 'error', 'row has no expectationId');
      continue;
    }
    if (!catalogue.has(r.expectationId)) {
      add(r, 'error', `expectationId ${r.expectationId} is not in the G1–8 catalogue`);
    }
    const prev = seen.get(r.expectationId);
    if (prev !== undefined) {
      add(r, 'error', `duplicate row for ${r.expectationId} (also row ${prev})`);
    } else seen.set(r.expectationId, r.rowNumber);

    const decision = r.educatorDecision;
    const coverage = r.educatorCoverage.toLowerCase();
    const tokens = skillTokens(r.educatorSkillIds);
    const realSkills = tokens.filter((t) => SKILL_ID_RE.test(t));
    const newSkills = tokens.filter(isNewSkillToken);
    const other = tokens.filter(
      (t) => !SKILL_ID_RE.test(t) && !isNewSkillToken(t) && t.toUpperCase() !== SKILL_TOKEN_NONE,
    );

    // A blank decision is an un-reviewed row — fine, just not yet decided.
    if (decision === '') {
      if (tokens.length > 0 || r.educatorCoverage !== '') {
        add(r, 'warning', 'has educator skills/coverage but no educator_decision yet');
      }
      continue;
    }
    if (!(EDUCATOR_DECISIONS as readonly string[]).includes(decision)) {
      add(
        r,
        'error',
        `educator_decision "${r.educatorDecision}" is not one of ${EDUCATOR_DECISIONS.join('/')}`,
      );
      continue;
    }
    // A decision must be signed.
    if (!r.reviewer) add(r, 'error', `${decision} needs a reviewer (sign-off)`);

    // Malformed skill tokens.
    for (const t of other) add(r, 'error', `"${t}" is not a valid skill id, NEW-SKILL, or NONE`);
    // A referenced real skill that we don't know yet — likely a typo, maybe a
    // planned skill. Advisory, not blocking.
    for (const t of realSkills) {
      if (!known.has(t)) add(r, 'warning', `skill ${t} is not a known teachable skill (typo?)`);
    }

    if (decision === 'CONFIRM' || decision === 'REVISE') {
      if (realSkills.length === 0 && newSkills.length === 0) {
        add(r, 'error', `${decision} requires at least one skill id (or NEW-SKILL)`);
      }
      if (coverage !== 'full' && coverage !== 'partial') {
        add(r, 'error', `${decision} requires educator_coverage of full or partial`);
      }
      if (decision === 'CONFIRM') {
        const proposed = skillTokens(r.proposedSkillIds);
        if (proposed.length === 0) {
          add(r, 'warning', 'CONFIRM on a row with no system proposal — did you mean AUTHOR?');
        } else if (
          realSkills.length > 0 &&
          [...realSkills].sort().join(',') !== [...proposed].sort().join(',')
        ) {
          add(
            r,
            'warning',
            'CONFIRM but educator skills differ from the proposal — did you mean REVISE?',
          );
        }
      }
    }
    if (decision === 'AUTHOR' && newSkills.length === 0) {
      add(r, 'warning', 'AUTHOR usually names a NEW-SKILL token in educator_skillIds');
    }
    if (
      (decision === 'REJECT' || decision === 'NONE') &&
      (realSkills.length > 0 || newSkills.length > 0)
    ) {
      add(r, 'error', `${decision} must not list any skills`);
    }
  }
  return issues;
}

/** Summarise authoring progress across a filled worksheet. Pure. */
export function summarizeAuthoringProgress(rows: readonly FilledWorksheetRow[]): AuthoringProgress {
  const byDecision: Record<string, number> = {};
  const grp = new Map<string, { subject: string; grade: number; total: number; decided: number }>();
  let decided = 0;
  for (const r of rows) {
    const d = r.educatorDecision || '(none)';
    byDecision[d] = (byDecision[d] ?? 0) + 1;
    const isDecided =
      r.educatorDecision !== '' &&
      (EDUCATOR_DECISIONS as readonly string[]).includes(r.educatorDecision);
    if (isDecided) decided++;
    const key = `${r.subject}:${r.grade}`;
    const g = grp.get(key) ?? { subject: r.subject, grade: r.grade, total: 0, decided: 0 };
    g.total++;
    if (isDecided) g.decided++;
    grp.set(key, g);
  }
  const total = rows.length;
  return {
    total,
    decided,
    remaining: total - decided,
    byDecision,
    bySubjectGrade: [...grp.values()]
      .sort((a, b) => a.subject.localeCompare(b.subject) || a.grade - b.grade)
      .map((g) => ({ ...g, remaining: g.total - g.decided })),
  };
}

/* ---------- scaffolding (non-judgmental cross-references) --------------------- */

/** The set of every catalogue expectation id (G1–8), for stray-row detection. */
export function catalogueExpectationIds(): Set<string> {
  return new Set(buildOverlayWorksheet().map((r) => r.expectationId));
}

export interface ScaffoldedRow extends OverlayWorksheetRow {
  /** Skills already proposed for OTHER expectations under the same overall code —
   *  an educator can reuse one rather than invent. Factual cross-reference only. */
  readonly nearbySkillIds: string;
}

/**
 * Enrich the worksheet with a `nearbySkillIds` column: the skills already proposed
 * under the same overall expectation (same subject+grade+overallCode). This helps
 * an educator reuse an existing teachable skill instead of authoring a duplicate.
 * It proposes nothing and signs nothing — it only surfaces what already exists.
 */
export function buildScaffoldedWorksheet(): ScaffoldedRow[] {
  const rows = buildOverlayWorksheet();
  const byOverall = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.proposedSkillIds) continue;
    const key = `${r.subject}:${r.grade}:${r.overallCode}`;
    const set = byOverall.get(key) ?? new Set<string>();
    for (const s of skillTokens(r.proposedSkillIds)) set.add(s);
    byOverall.set(key, set);
  }
  return rows.map((r) => {
    const key = `${r.subject}:${r.grade}:${r.overallCode}`;
    const own = new Set(skillTokens(r.proposedSkillIds));
    const nearby = [...(byOverall.get(key) ?? new Set<string>())].filter((s) => !own.has(s));
    return { ...r, nearbySkillIds: nearby.join(', ') };
  });
}
