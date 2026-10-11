import type { Hono } from 'hono';
import { DomainError } from '@potenova/contracts';
import {
  evaluateMathCandidate,
  parseGeneratedMathAnswer,
  buildComparisonPrompt,
  runMathEvalSuite,
  DEFAULT_MATH_EVAL_SUITE,
  type Fraction,
  type GeneratedMathAnswer,
  type MathEvalTask,
} from '@potenova/content';
import { readAuth, requireActorType, assertRegion } from '../auth';
import { now, type Deps } from '../deps';

/**
 * AI candidate-evaluation surface (AI-003; ADR-0005/0006).
 *
 * Operator-only. Runs a real (candidate, non-approved) model behind the gateway
 * on a SYNTHETIC fraction-comparison task, then validates its answer with the
 * INDEPENDENT deterministic Math oracle and runs it through the child-facing
 * content gate — purely to measure the model. The result is NEVER delivered to a
 * child (`deliveredToChild: false`). Every LOCKED invariant holds at the edge:
 *
 *  - operator actor type + Canadian residency (role/region authz);
 *  - the gateway's evaluation path refuses non-synthetic data, a non-Canadian
 *    region, or a model absent from the registry (fail-closed);
 *  - the candidate is SYNTHETIC_TESTING, never APPROVED — so it can never be
 *    reached by a production child route;
 *  - generator (model) ≠ validator (oracle) — no self-blessing.
 */

const VALIDATOR_ID = 'math-oracle:fractions';
const VALIDATOR_VERSION = 'v1';

/** A built-in synthetic task so the route is runnable with an empty body. */
const DEFAULT_TASK = {
  left: { numerator: 1, denominator: 2 },
  right: { numerator: 1, denominator: 3 },
};

interface EvalRequestBody {
  left?: Fraction;
  right?: Fraction;
  fallbackAssetId?: string | null;
}

function readFraction(f: Fraction | undefined, fallback: Fraction): Fraction {
  if (!f) return fallback;
  if (!Number.isInteger(f.numerator) || !Number.isInteger(f.denominator) || f.denominator <= 0) {
    throw new DomainError(
      'POLICY_BLOCKED',
      'fraction must have integer numerator and positive denominator',
    );
  }
  return { numerator: f.numerator, denominator: f.denominator };
}

export function registerAiEval(app: Hono, deps: Deps): void {
  app.post('/operator/model-eval', async (c) => {
    const a = readAuth(c, deps.config.primaryRegion);
    requireActorType(a, 'operator');
    assertRegion(a);

    const provider = deps.ai.provider;
    if (!provider || !deps.ai.candidateModelId) {
      throw new DomainError('DEPENDENCY_UNAVAILABLE', 'no AI provider configured for evaluation');
    }

    // Fail-closed gateway gate: synthetic-only, Canadian region, model in registry.
    deps.ai.gateway.routeForEvaluation(deps.ai.candidateModelId, {
      synthetic: true,
      processingRegion: provider.region,
    });

    const body = await c.req.json<EvalRequestBody>().catch(() => ({}) as EvalRequestBody);
    const task = {
      left: readFraction(body.left, DEFAULT_TASK.left),
      right: readFraction(body.right, DEFAULT_TASK.right),
    };

    const gen = await provider.generate({ ...buildComparisonPrompt(task), temperature: 0 });
    const generated = parseGeneratedMathAnswer(gen.text);

    const result = evaluateMathCandidate({
      task,
      generatorId: deps.ai.candidateModelId,
      validatorId: VALIDATOR_ID,
      validatorVersion: VALIDATOR_VERSION,
      generated,
      fallbackAssetId: body.fallbackAssetId ?? null,
      now,
    });

    return c.json({
      synthetic: true,
      deliveredToChild: false,
      model: provider.id,
      processingRegion: provider.region,
      task,
      groundTruth: result.groundTruth,
      claimedAnswer: result.claimedAnswer,
      explanation: result.explanation,
      verdict: result.verdict,
      reasonCodes: result.reasonCodes,
      delivery: result.delivery,
      tokenUnits: gen.units,
    });
  });

  // Run the full synthetic evaluation suite against the candidate and return a
  // scored, evidence-ready report (ER-16 quality/safety evaluation).
  app.post('/operator/model-eval/suite', async (c) => {
    const a = readAuth(c, deps.config.primaryRegion);
    requireActorType(a, 'operator');
    assertRegion(a);

    const provider = deps.ai.provider;
    if (!provider || !deps.ai.candidateModelId) {
      throw new DomainError('DEPENDENCY_UNAVAILABLE', 'no AI provider configured for evaluation');
    }
    deps.ai.gateway.routeForEvaluation(deps.ai.candidateModelId, {
      synthetic: true,
      processingRegion: provider.region,
    });

    let tokenUnits = 0;
    const generate = async (task: MathEvalTask): Promise<GeneratedMathAnswer> => {
      const gen = await provider.generate({ ...buildComparisonPrompt(task), temperature: 0 });
      tokenUnits += gen.units;
      return parseGeneratedMathAnswer(gen.text);
    };

    const report = await runMathEvalSuite({
      tasks: DEFAULT_MATH_EVAL_SUITE,
      generatorId: deps.ai.candidateModelId,
      validatorId: VALIDATOR_ID,
      validatorVersion: VALIDATOR_VERSION,
      generate,
      now,
    });

    return c.json({
      synthetic: true,
      deliveredToChild: false,
      model: provider.id,
      processingRegion: provider.region,
      tokenUnits,
      report,
    });
  });
}
