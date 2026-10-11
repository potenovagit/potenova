import type { GenerativeProvider } from '@potenova/ai-gateway';
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
  const generate = async (task: SuiteTask): Promise<SuiteAnswer> => {
    if (task.kind === 'comparison') {
      const g = await provider.generate({ ...buildComparisonPrompt(task), temperature: 0 });
      tokenUnits += g.units;
      return { kind: 'comparison', ...parseGeneratedMathAnswer(g.text) };
    }
    const g = await provider.generate({ ...buildEquivalencePrompt(task), temperature: 0 });
    tokenUnits += g.units;
    return { kind: 'equivalence', ...parseGeneratedEquivalenceAnswer(g.text) };
  };
  return { generate, getTokens: () => tokenUnits };
}
