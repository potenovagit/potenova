import { describe, it, expect } from 'vitest';
import { loadConfig } from '@potenova/config';
import { isDomainError } from '@potenova/contracts';

describe('config + residency (SEC-002, B9)', () => {
  it('loads a valid Canadian dev config; dev forbids real child data', () => {
    const c = loadConfig({ APP_ENV: 'dev', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' });
    expect(c.environment).toBe('dev');
    expect(c.allowRealChildData).toBe(false);
  });

  it('only prod may carry real child data', () => {
    expect(loadConfig({ APP_ENV: 'prod' }).allowRealChildData).toBe(true);
    for (const e of ['dev', 'test', 'qa', 'staging']) {
      expect(loadConfig({ APP_ENV: e }).allowRealChildData).toBe(false);
    }
  });

  it('accepts qa as a non-prod, Canadian, synthetic-only environment', () => {
    const c = loadConfig({ APP_ENV: 'qa', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' });
    expect(c.environment).toBe('qa');
    expect(c.allowRealChildData).toBe(false);
  });

  it('rejects an unknown environment label (fail-closed)', () => {
    try {
      loadConfig({ APP_ENV: 'uat' });
      throw new Error('expected POLICY_BLOCKED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });

  it('rejects a non-Canadian region (fail-closed)', () => {
    try {
      loadConfig({ APP_ENV: 'prod', PRIMARY_REGION: 'us-east-1' });
      throw new Error('expected REGION_DISALLOWED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('REGION_DISALLOWED');
    }
  });

  it('rejects identical primary and DR regions', () => {
    try {
      loadConfig({ APP_ENV: 'prod', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-central' });
      throw new Error('expected POLICY_BLOCKED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });
});
