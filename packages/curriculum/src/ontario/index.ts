/**
 * Ontario curriculum catalogue (full G1–8 scope, ADR-0022).
 *
 * The authoritative, SOURCE-VERIFIED layer: official strands and expectations
 * (with their real Ontario codes and wording) extracted from the Ministry
 * curriculum site — Mathematics (2020) and Language (2023). Each grade+subject
 * is a JSON data file under `./data`; adding a grade is adding a file.
 *
 * This is the catalogue only. It is NOT educator-reviewed (every release is
 * `reviewStatus: 'draft'`), and it is NOT the teachable-skill/prerequisite
 * overlay or any mastery threshold — those are a separate, review-gated layer
 * (ER-03/NFR-08, EVIDENCE REQUIRED). Nothing here sets mastery or reaches a
 * child; it is reference data for authoring and for the educator review.
 */

import type { CurriculumExpectation, CurriculumRelease } from '../entities';
import mathG1 from './data/math-g1.json';
import languageG1 from './data/language-g1.json';
import mathG2 from './data/math-g2.json';
import languageG2 from './data/language-g2.json';
import mathG3 from './data/math-g3.json';
import languageG3 from './data/language-g3.json';
import mathG4 from './data/math-g4.json';
import languageG4 from './data/language-g4.json';

/** Shape of a grade+subject data file (source-verified extraction). */
export interface OntarioCurriculumData {
  readonly jurisdiction: string;
  readonly subject: string;
  readonly grade: number;
  readonly edition: string;
  readonly sourceUrl: string;
  readonly extractedAt: string;
  readonly reviewStatus: 'draft' | 'reviewed';
  readonly note?: string;
  readonly strands: ReadonlyArray<{ readonly code: string; readonly name: string }>;
  readonly expectations: ReadonlyArray<{
    readonly sourceCode: string; // e.g. "B1.1"
    readonly strand: string; // e.g. "B"
    readonly overallCode: string; // e.g. "B1"
    readonly text: string;
  }>;
}

export type OntarioSubject = 'math' | 'language';

/** Every grade+subject data file loaded into the catalogue. */
const DATASETS: readonly OntarioCurriculumData[] = [
  mathG1 as OntarioCurriculumData,
  languageG1 as OntarioCurriculumData,
  mathG2 as OntarioCurriculumData,
  languageG2 as OntarioCurriculumData,
  mathG3 as OntarioCurriculumData,
  languageG3 as OntarioCurriculumData,
  mathG4 as OntarioCurriculumData,
  languageG4 as OntarioCurriculumData,
];

const releaseId = (subject: string, grade: number): string =>
  `REL-ONT-${subject.toUpperCase()}-G${grade}`;

const SPECIFIC_CODE = /^[A-F]\d+\.\d+$/;
const OVERALL_CODE = /^[A-F]\d+$/;

/**
 * Validate a dataset's internal consistency. Throws on any structural problem
 * so bad data can never silently enter the catalogue. Pure; used by tests and
 * at load. Does NOT judge pedagogical correctness — that is the educator's.
 */
export function validateOntarioData(d: OntarioCurriculumData): void {
  const where = `${d.subject} G${d.grade}`;
  if (!d.sourceUrl || !d.extractedAt) throw new Error(`${where}: missing provenance`);
  const strandCodes = new Set(d.strands.map((s) => s.code));
  if (strandCodes.size !== d.strands.length) throw new Error(`${where}: duplicate strand code`);
  const seen = new Set<string>();
  for (const e of d.expectations) {
    if (!SPECIFIC_CODE.test(e.sourceCode)) throw new Error(`${where}: bad code ${e.sourceCode}`);
    if (!OVERALL_CODE.test(e.overallCode))
      throw new Error(`${where}: bad overall ${e.overallCode}`);
    if (seen.has(e.sourceCode)) throw new Error(`${where}: duplicate ${e.sourceCode}`);
    seen.add(e.sourceCode);
    if (e.sourceCode[0] !== e.strand)
      throw new Error(`${where}: ${e.sourceCode} ≠ strand ${e.strand}`);
    if (!e.sourceCode.startsWith(e.overallCode + '.'))
      throw new Error(`${where}: ${e.sourceCode} not under ${e.overallCode}`);
    if (!strandCodes.has(e.strand)) throw new Error(`${where}: ${e.sourceCode} unknown strand`);
    if (!e.text || e.text.trim().length < 3)
      throw new Error(`${where}: ${e.sourceCode} empty text`);
  }
}

for (const d of DATASETS) validateOntarioData(d);

/** The release record for a loaded grade+subject (always DRAFT). */
export function ontarioRelease(d: OntarioCurriculumData): CurriculumRelease {
  return {
    curriculumReleaseId: releaseId(d.subject, d.grade),
    jurisdiction: d.jurisdiction,
    subject: d.subject,
    gradeRange: `G${d.grade}`,
    edition: d.edition,
    validFrom: d.extractedAt,
    status: 'draft',
    sourceUrl: d.sourceUrl,
    extractedAt: d.extractedAt,
  };
}

/** Flatten a dataset's specific expectations into CurriculumExpectation records
 *  (reviewStatus 'draft' — source-verified but not yet educator-reviewed). */
export function ontarioExpectations(d: OntarioCurriculumData): CurriculumExpectation[] {
  const rel = releaseId(d.subject, d.grade);
  const strandName = new Map(d.strands.map((s) => [s.code, s.name]));
  return d.expectations.map((e) => ({
    expectationId: `EXP-ONT-${d.subject.toUpperCase()}-G${d.grade}-${e.sourceCode}`,
    curriculumReleaseId: rel,
    sourceCode: e.sourceCode,
    strand: strandName.get(e.strand) ?? e.strand,
    grade: d.grade,
    statementRef: e.text,
    reviewStatus: 'draft',
  }));
}

/** All loaded datasets. */
export function ontarioDatasets(): readonly OntarioCurriculumData[] {
  return DATASETS;
}

/** The dataset for a subject+grade, or undefined if not yet loaded. */
export function ontarioDataset(
  subject: OntarioSubject,
  grade: number,
): OntarioCurriculumData | undefined {
  return DATASETS.find((d) => d.subject === subject && d.grade === grade);
}

/** Catalogue coverage summary — which subject/grades are loaded and how many
 *  expectations each has. Useful for the educator-review packaging and NFR-10
 *  coverage tracking. */
export function ontarioCoverage(): Array<{
  subject: string;
  grade: number;
  strands: number;
  expectations: number;
  reviewStatus: string;
}> {
  return DATASETS.map((d) => ({
    subject: d.subject,
    grade: d.grade,
    strands: d.strands.length,
    expectations: d.expectations.length,
    reviewStatus: d.reviewStatus,
  }));
}
