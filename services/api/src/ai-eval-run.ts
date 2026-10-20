import {
  boundedGenerate,
  type GenerativeProvider,
  type GenerativeRequest,
} from '@potenova/ai-gateway';
import {
  buildComparisonPrompt,
  parseGeneratedMathAnswer,
  buildEquivalencePrompt,
  parseGeneratedEquivalenceAnswer,
  type SuiteTask,
  type SuiteAnswer,
} from '@potenova/content';

/**
 * Build a suite `generate` function from a live provider: it picks the right
 * prompt + parser per task skill and tallies token cost. Shared by the eval
 * route and the eval CLI so both query the model identically.
 */
export function providerSuiteRunner(provider: GenerativeProvider): {
  generate: (task: SuiteTask) => Promise<SuiteAnswer>;
  getTokens: () => number;
} {
  let tokenUnits = 0;
  // Bounded, fallback-safe per task (AI-015): a transient failure is retried
  // within bounds, and exhaustion yields an unparsed answer (contained, never a
  // pass) rather than throwing and aborting the whole suite.
  const call = (prompt: GenerativeRequest) =>
    boundedGenerate(provider, { ...prompt, temperature: 0 });
  const generate = async (task: SuiteTask): Promise<SuiteAnswer> => {
    if (task.kind === 'comparison') {
      const out = await call(buildComparisonPrompt(task));
      tokenUnits += out.units;
      return out.kind === 'OK'
        ? { kind: 'comparison', ...parseGeneratedMathAnswer(out.result.text) }
        : { kind: 'comparison', claimedAnswer: null, explanation: '' };
    }
    const out = await call(buildEquivalencePrompt(task));
    tokenUnits += out.units;
    return out.kind === 'OK'
      ? { kind: 'equivalence', ...parseGeneratedEquivalenceAnswer(out.result.text) }
      : { kind: 'equivalence', claimedEquivalent: null, explanation: '' };
  };
  return { generate, getTokens: () => tokenUnits };
}
