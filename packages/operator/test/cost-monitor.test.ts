import { describe, it, expect } from 'vitest';
import { marginRollup, detectSpendAnomaly } from '@potenova/operator';

describe('cost/margin + spend anomaly (OPS-011/012; ADM-001; AT-40)', () => {
  it('OPS-011: margin rollup computes revenue-minus-cost with no child content', () => {
    const r = marginRollup({ costCents: 300, revenueCents: 1000 });
    expect(r.marginCents).toBe(700);
    expect(r.childContentExposed).toBe(false);
  });

  it('AT-40: a spend spike alerts admin, bounds remediation, keeps a child-safe fallback, no child token message', () => {
    const d = detectSpendAnomaly({
      spendRateCentsPerMin: 500,
      spendThresholdCentsPerMin: 100,
      retries: 0,
      retryThreshold: 5,
    });
    expect(d.anomaly).toBe(true);
    expect(d.alertAdmin).toBe(true);
    expect(d.action).toBe('BOUNDED_REMEDIATION');
    expect(d.childSafeFallback).toBe(true);
    expect(d.childTokenMessage).toBe(false);
  });

  it('a runaway retry count also trips the anomaly', () => {
    const d = detectSpendAnomaly({
      spendRateCentsPerMin: 10,
      spendThresholdCentsPerMin: 100,
      retries: 9,
      retryThreshold: 5,
    });
    expect(d.anomaly).toBe(true);
  });

  it('normal spend is not an anomaly', () => {
    const d = detectSpendAnomaly({
      spendRateCentsPerMin: 10,
      spendThresholdCentsPerMin: 100,
      retries: 1,
      retryThreshold: 5,
    });
    expect(d.anomaly).toBe(false);
    expect(d.action).toBe('NONE');
  });
});
