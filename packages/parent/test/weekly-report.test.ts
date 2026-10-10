import { describe, it, expect } from 'vitest';
import { buildWeeklyReport, type RawReportItem } from '@potenova/parent';
import { isDomainError } from '@potenova/contracts';

describe('weekly report (PAR-003; AT-32)', () => {
  it('separates facts, interpretation and recommendation', () => {
    const items: RawReportItem[] = [
      { kind: 'observed_evidence', text: '12 unaided fraction comparisons' },
      { kind: 'interpretation', text: 'comparison is becoming independent' },
      { kind: 'recommendation', text: 'introduce equivalence next' },
    ];
    const r = buildWeeklyReport('lnr', items, 'early signal, limited data');
    expect(r.facts).toHaveLength(1);
    expect(r.interpretation).toHaveLength(1);
    expect(r.recommendation).toHaveLength(1);
    expect(r.uncertaintyNote).toContain('limited data');
  });

  it('AT-32: refuses a fabricated school-grade prediction', () => {
    try {
      buildWeeklyReport('lnr', [{ kind: 'predicted_grade', text: 'will get a B+' }], '');
      throw new Error('expected POLICY_BLOCKED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });
});
