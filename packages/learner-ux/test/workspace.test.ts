import { describe, it, expect } from 'vitest';
import { createWorkspace, addStep, reasoningEvidenceSteps } from '@potenova/learner-ux';

describe('math workspace model (AI Learning §6)', () => {
  it('accumulates steps and counts only confidently-recognized ones as reasoning evidence', () => {
    let ws = createWorkspace('lnr', 'SK-FR-compare');
    ws = addStep(ws, { stepId: 's1', manipulative: 'area-model', recognitionConfidence: 0.95 });
    ws = addStep(ws, { stepId: 's2', manipulative: 'whiteboard', recognitionConfidence: 0.4 });
    ws = addStep(ws, { stepId: 's3', manipulative: 'number-line', recognitionConfidence: 0.8 });

    expect(ws.steps).toHaveLength(3); // all kept for display
    expect(reasoningEvidenceSteps(ws).map((s) => s.stepId)).toEqual(['s1', 's3']); // s2 too low
  });
});
