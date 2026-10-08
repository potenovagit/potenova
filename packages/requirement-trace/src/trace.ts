import { readFileSync } from 'node:fs';
import { parseCsvRecords } from './csv';

/**
 * Requirement traceability (GOV-002: requirements SHALL be traceable through
 * tests, code, risks, decisions and verification artifacts).
 *
 * This tool imports the v2 register (spec/requirements.csv — the "v2 constraints
 * imported" WP-00 exit condition) and produces a machine-checkable summary plus
 * a set of hard structural assertions that CI fails on.
 */

export const KNOWN_WORK_PACKAGES = [
  'WP-00',
  'WP-01',
  'WP-02',
  'WP-03',
  'WP-04',
  'WP-05',
  'WP-06',
  'WP-07',
  'WP-08',
  'WP-09',
  'WP-10',
  'WP-11',
  'WP-12',
  'WP-13',
  'WP-14',
  'WP-15',
] as const;

export interface TraceReport {
  generatedAt: string;
  csvPath: string;
  totalRequirements: number;
  byDomain: Record<string, number>;
  byWorkPackage: Record<string, number>;
  byRiskClass: Record<string, number>;
  byScope: Record<string, number>;
  byState: Record<string, number>;
  implementationStatus: Record<string, number>;
  problems: string[];
}

function tally(records: Array<Record<string, string>>, key: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of records) {
    const v = r[key] ?? '(missing)';
    out[v] = (out[v] ?? 0) + 1;
  }
  return out;
}

export function buildTraceReport(csvPath: string): TraceReport {
  const records = parseCsvRecords(readFileSync(csvPath, 'utf8'));
  const problems: string[] = [];

  for (const r of records) {
    const id = r['id'] ?? '';
    if (!id) problems.push('row with missing id');
    if (!r['domain']) problems.push(`${id}: missing domain`);
    if (!r['acceptance']) problems.push(`${id}: missing acceptance clause (GOV-002)`);
    if (!r['test_ref']) problems.push(`${id}: missing test_ref (GOV-002)`);
    const wp = r['work_package'] ?? '';
    if (wp && !(KNOWN_WORK_PACKAGES as readonly string[]).includes(wp)) {
      problems.push(`${id}: unknown work_package "${wp}"`);
    }
    const state = r['state'] ?? '';
    if (state && state !== 'LOCKED') {
      // Not necessarily an error, but WP-00 treats non-LOCKED as needing review.
      problems.push(`${id}: non-LOCKED state "${state}" — confirm in register`);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    csvPath,
    totalRequirements: records.length,
    byDomain: tally(records, 'domain'),
    byWorkPackage: tally(records, 'work_package'),
    byRiskClass: tally(records, 'risk_class'),
    byScope: tally(records, 'scope'),
    byState: tally(records, 'state'),
    implementationStatus: tally(records, 'implementation_status'),
    problems,
  };
}

/** Hard structural expectations for the v2.0 baseline (fail CI if violated). */
export function assertBaselineShape(report: TraceReport): string[] {
  const failures: string[] = [];
  if (report.totalRequirements !== 276) {
    failures.push(`expected 276 requirements, found ${report.totalRequirements}`);
  }
  if (Object.keys(report.byDomain).length !== 16) {
    failures.push(`expected 16 domains, found ${Object.keys(report.byDomain).length}`);
  }
  if ((report.byWorkPackage['WP-00'] ?? 0) < 1) {
    failures.push('no WP-00 requirements found in register');
  }
  if ((report.byState['LOCKED'] ?? 0) !== report.totalRequirements) {
    failures.push('not all requirements are LOCKED in the v2 baseline');
  }
  return failures;
}
