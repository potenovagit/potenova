import { describe, it, expect } from 'vitest';
import {
  bandForGrade,
  confidencePct,
  standingLabel,
  standingTone,
  reasonCodeLabel,
  usageDecisionLabel,
  minutesLabel,
  policyState,
  modelStatusTone,
} from '../src/format';

describe('web presentation helpers', () => {
  it('labels every known standing in parent/child-friendly words', () => {
    expect(standingLabel('demonstrated')).toBe('Demonstrated');
    expect(standingLabel('developing')).toBe('Developing');
    expect(standingLabel('emerging')).toBe('Emerging');
    expect(standingLabel('needs_review')).toBe('Needs a closer look');
    expect(standingLabel('unknown')).toBe('Not yet assessed');
  });

  it('falls back to humanised text for an unexpected standing', () => {
    expect(standingLabel('some_new_state')).toBe('some new state');
  });

  it('maps standings to a colour tone', () => {
    expect(standingTone('demonstrated')).toBe('good');
    expect(standingTone('developing')).toBe('mid');
    expect(standingTone('emerging')).toBe('mid');
    expect(standingTone('unknown')).toBe('low');
    expect(standingTone('needs_review')).toBe('low');
  });

  it('clamps and rounds confidence to a percent', () => {
    expect(confidencePct(0)).toBe('0%');
    expect(confidencePct(0.5)).toBe('50%');
    expect(confidencePct(0.834)).toBe('83%');
    expect(confidencePct(1)).toBe('100%');
    expect(confidencePct(1.4)).toBe('100%');
    expect(confidencePct(-0.2)).toBe('0%');
  });

  it('chooses an age band from grade (LUX-001)', () => {
    expect(bandForGrade(1)).toBe('primary');
    expect(bandForGrade(3)).toBe('primary');
    expect(bandForGrade(4)).toBe('junior');
    expect(bandForGrade(6)).toBe('junior');
    expect(bandForGrade(7)).toBe('intermediate');
    expect(bandForGrade(8)).toBe('intermediate');
  });

  it('labels planner reason codes in plain language', () => {
    expect(reasonCodeLabel('PREREQUISITE_REMEDIATION')).toBe('Building a foundation first');
    expect(reasonCodeLabel('LOW_CONFIDENCE_VERIFICATION')).toBe('Checking this is solid');
    expect(reasonCodeLabel('TRANSFER_CHECK')).toBe('Ready for a challenge');
    expect(reasonCodeLabel('PARENT_PREFERENCE')).toBe('Following your focus');
    expect(reasonCodeLabel('WHATEVER_NEW')).toBe('whatever new');
  });

  it('labels usage-cap decisions and minutes', () => {
    expect(usageDecisionLabel('ALLOW')).toBe('Full time allowed');
    expect(usageDecisionLabel('SHORTEN')).toBe('Shortened to fit the limit');
    expect(usageDecisionLabel('STOP')).toBe('Daily limit reached');
    expect(minutesLabel(15)).toBe('15 min');
    expect(minutesLabel(null)).toBe('—');
    expect(minutesLabel(undefined)).toBe('—');
  });

  it('maps a fail-closed policy to a reviewer status + tone', () => {
    expect(policyState(false)).toEqual({ label: 'Draft — pending approval', tone: 'mid' });
    expect(policyState(true)).toEqual({ label: 'Approved', tone: 'good' });
    expect(policyState(false, false)).toEqual({ label: 'Not configured', tone: 'low' });
  });

  it('maps a model status to a label + tone without implying production use', () => {
    expect(modelStatusTone('SYNTHETIC_TESTING').label).toBe('Synthetic testing only');
    expect(modelStatusTone('SYNTHETIC_TESTING').tone).toBe('mid');
    expect(modelStatusTone(null).label).toBe('None wired');
    expect(modelStatusTone('APPROVED').tone).toBe('good');
  });
});
