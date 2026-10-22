import { describe, it, expect } from 'vitest';
import { runGateDryRun, renderGateDryRunReport } from '../src/gate-dryrun';

/**
 * Keeps the Stage-2 gate dry-run honest: every fail-closed mechanism it exercises
 * must hold, so the filed evidence can be trusted and a regression that opens a
 * gate breaks CI. Synthetic only.
 */
describe('Stage-2 gate dry-run (synthetic)', () => {
  it('every fail-closed gate holds end-to-end', async () => {
    const report = await runGateDryRun();
    const failed = report.checks.filter((c) => c.result === 'FAIL');
    // Surfaces exactly which gate regressed if this ever fails.
    expect(failed.map((c) => `${c.id}: ${c.observed}`)).toEqual([]);
    expect(report.allPass).toBe(true);
    // The specific non-negotiables we claim coverage of are all present.
    const ids = new Set(report.checks.map((c) => c.id));
    for (const id of [
      'G-CONSENT-BEFORE',
      'G-CONSENT-AFTER',
      'G-CONSENT-REVOKE',
      'G-CONTENT-UNSERVABLE',
      'G-RESIDENCY',
      'G-MASTERY-ADVISORY',
      'G-MASTERY-ISOLATION',
      'G-ERASURE-FIRSTPARTY',
      'G-ERASURE-COMPLETE',
      'G-RETENTION-DRYRUN',
      'G-AI-FAILCLOSED',
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it('renders a filable Markdown report', async () => {
    const report = await runGateDryRun();
    const md = renderGateDryRunReport(report);
    expect(md).toContain('# Stage-2 gate dry-run');
    expect(md).toContain('synthetic');
  });
});
