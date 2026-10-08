import { describe, it, expect } from 'vitest';
import { buildTraceReport, assertBaselineShape } from '@potenova/requirement-trace';

// cwd is the repo root under vitest.
const CSV = 'spec/requirements.csv';

describe('requirement trace against the v2 register (GOV-002)', () => {
  const report = buildTraceReport(CSV);

  it('imports the full v2.0 baseline (276 reqs, 16 domains, all LOCKED)', () => {
    expect(report.totalRequirements).toBe(276);
    expect(Object.keys(report.byDomain)).toHaveLength(16);
    expect(report.byState['LOCKED']).toBe(276);
    expect(assertBaselineShape(report)).toEqual([]);
  });

  it('maps WP-00 and WP-01 requirement counts', () => {
    expect(report.byWorkPackage['WP-00']).toBe(15);
    expect(report.byWorkPackage['WP-01']).toBe(13);
  });

  it('every work_package value is a known WP', () => {
    const unknown = report.problems.filter((p) => p.includes('unknown work_package'));
    expect(unknown).toEqual([]);
  });

  it('nothing is implemented yet (specification baseline, not code)', () => {
    expect(report.implementationStatus['SPECIFIED_NOT_IMPLEMENTED']).toBe(276);
  });
});
