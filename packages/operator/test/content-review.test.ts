import { describe, it, expect } from 'vitest';
import { operatorQuarantine, routeSupportCase, type ReviewCase } from '@potenova/operator';
import { QuarantineRegistry } from '@potenova/content';
import { isDomainError } from '@potenova/contracts';

const reviewCase: ReviewCase = {
  caseId: 'rc-1',
  kind: 'validation_failure',
  assetId: 'asset-9',
  assetVersion: 'v2',
};

describe('operations content review (OPS-010; AT-48/49)', () => {
  it('AT-49: a reviewer quarantine removes the asset and opens a regression case', () => {
    const registry = new QuarantineRegistry();
    const rec = operatorQuarantine(registry, reviewCase, {
      reviewer: 'reviewer-1',
      reasonCode: 'WRONG_KEY',
    });
    expect(registry.isSelectable('asset-9')).toBe(false);
    expect(rec.regressionCaseId).toMatch(/^RC-\d{4}-asset-9$/);
  });

  it('quarantine requires an authorized reviewer', () => {
    const registry = new QuarantineRegistry();
    try {
      operatorQuarantine(registry, reviewCase, { reviewer: '', reasonCode: 'x' });
      throw new Error('expected FORBIDDEN_ROLE');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('FORBIDDEN_ROLE');
    }
  });

  it('AT-48: support cases route by type with minimal metadata unless sensitive access is approved', () => {
    expect(routeSupportCase('wrong_answer')).toEqual({
      queue: 'content_quality',
      includesChildContent: false,
    });
    expect(routeSupportCase('technical_error')).toEqual({
      queue: 'engineering',
      includesChildContent: false,
    });
    expect(routeSupportCase('wrong_answer', true).includesChildContent).toBe(true);
  });
});
