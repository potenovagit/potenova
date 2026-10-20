import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isApprovedRegion } from '@potenova/contracts';
import {
  AIGateway,
  ModelRegistry,
  AzureOpenAiChatProvider,
  SelfHostedChatProvider,
  type GenerativeProvider,
} from '@potenova/ai-gateway';
import {
  runEvalSuite,
  buildEvalEvidence,
  renderEvalEvidenceMarkdown,
  DEFAULT_EVAL_SUITE,
} from '@potenova/content';
import { providerSuiteRunner } from './ai-eval-run';

/**
 * CLI: run the synthetic model-evaluation suite against a candidate model and
 * write a gate-ready evidence artifact. Two providers, chosen by env:
 *
 *   Self-hosted / OpenAI-compatible (vLLM, or a serverless host — ADR-0046):
 *     SELFHOST_ENDPOINT=https://api.together.xyz SELFHOST_MODEL=Qwen/Qwen2.5-7B-Instruct-Turbo \
 *     SELFHOST_API_KEY=... SELFHOST_REGION=us-east EVAL_ALLOW_NON_RESIDENT=true npm run eval:model
 *
 *   Azure OpenAI (in-Canada deployment):
 *     AZURE_OPENAI_ENDPOINT=... AZURE_OPENAI_DEPLOYMENT=tutor-mini AZURE_OPENAI_KEY=... npm run eval:model
 *
 * Synthetic data only; nothing is delivered to a child; the candidate is
 * registered SYNTHETIC_TESTING, never APPROVED. The eval is fail-closed on
 * RESIDENCY: a non-Canadian endpoint is refused UNLESS EVAL_ALLOW_NON_RESIDENT=true
 * is set, which runs a MODEL-QUALITY eval only — it measures the model (the result
 * transfers to the same weights hosted in Canada) and does NOT demonstrate
 * in-region inference. The true endpoint region is recorded in the artifact.
 * Writes evidence/<gate>/<req-id>/<run-id>/{report.json,summary.md}.
 */

const VALIDATOR_ID = 'math-oracle:fractions';
const VALIDATOR_VERSION = 'v1';

function fail(msg: string): never {
  // eslint-disable-next-line no-console
  console.error(`eval:model — ${msg}`);
  process.exit(1);
}

function buildProvider(): GenerativeProvider | null {
  const sh = process.env.SELFHOST_ENDPOINT;
  if (sh) {
    const model = process.env.SELFHOST_MODEL;
    const region = process.env.SELFHOST_REGION;
    if (!model || !region)
      fail('self-host eval needs SELFHOST_MODEL and SELFHOST_REGION (the endpoint region)');
    return new SelfHostedChatProvider({
      endpoint: sh,
      model,
      region,
      apiKey: process.env.SELFHOST_API_KEY,
      apiPath: process.env.SELFHOST_API_PATH,
    });
  }
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiKey = process.env.AZURE_OPENAI_KEY;
  if (endpoint && deployment && apiKey) {
    return new AzureOpenAiChatProvider({
      endpoint,
      deployment,
      apiKey,
      region: process.env.AZURE_OPENAI_REGION ?? 'ca-east',
      apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    });
  }
  return null;
}

async function main(): Promise<void> {
  const provider = buildProvider();
  if (!provider) {
    fail(
      'no provider configured — set SELFHOST_ENDPOINT/SELFHOST_MODEL/SELFHOST_REGION ' +
        'or AZURE_OPENAI_ENDPOINT/DEPLOYMENT/KEY',
    );
  }

  const resident = isApprovedRegion(provider.region);
  const allowNonResident = process.env.EVAL_ALLOW_NON_RESIDENT === 'true';
  if (!resident && !allowNonResident) {
    fail(
      `endpoint region '${provider.region}' is not Canadian. This would send data outside ` +
        `the residency boundary. For a SYNTHETIC model-quality eval on a non-Canadian endpoint, ` +
        `set EVAL_ALLOW_NON_RESIDENT=true (it does not certify in-region inference).`,
    );
  }

  // Register the candidate — NOT approved for production routing.
  const registry = new ModelRegistry();
  registry.register({
    modelId: provider.id,
    status: 'SYNTHETIC_TESTING',
    allowedRegions: [provider.region],
    ageBands: ['g1-3', 'g4-6', 'g7-8'],
    subjects: ['math'],
    capabilities: ['task_generation'],
    trainingDisabled: true,
  });
  // Residency gate (fail-closed) for a Canadian endpoint; the opt-in non-resident
  // path skips it deliberately and is a model-quality eval only.
  if (resident) {
    new AIGateway(registry).routeForEvaluation(provider.id, {
      synthetic: true,
      processingRegion: provider.region,
    });
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      `eval:model — NON-RESIDENT model-quality eval on '${provider.region}'. Synthetic data only; ` +
        `does NOT demonstrate in-region inference. Re-run on the Canadian deployment to certify residency.`,
    );
  }

  const runner = providerSuiteRunner(provider);
  const report = await runEvalSuite({
    tasks: DEFAULT_EVAL_SUITE,
    generatorId: provider.id,
    validatorId: VALIDATOR_ID,
    validatorVersion: VALIDATOR_VERSION,
    generate: runner.generate,
  });
  const tokenUnits = runner.getTokens();

  const runId = `run-${report.generatedAt.replace(/[:.]/g, '-')}`;
  const artifact = buildEvalEvidence({
    report,
    model: provider.id,
    processingRegion: provider.region,
    runId,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    tokenUnits,
  });

  const dir = join('evidence', artifact.gate, artifact.requirementId, runId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'report.json'), JSON.stringify(artifact, null, 2) + '\n', 'utf8');
  writeFileSync(join(dir, 'summary.md'), renderEvalEvidenceMarkdown(artifact), 'utf8');

  // eslint-disable-next-line no-console
  console.log(
    [
      `eval:model — ${artifact.result}`,
      `  model:      ${artifact.model} (${artifact.processingRegion}${resident ? '' : ' — NON-RESIDENT, quality-only'})`,
      `  accuracy:   ${(report.accuracy * 100).toFixed(1)}% (${report.correct}/${report.total})`,
      `  contained:  ${report.incorrectContained}/${report.incorrect} incorrect`,
      `  latency:    P50 ${report.latency.p50Ms}ms · P95 ${report.latency.p95Ms}ms · P99 ${report.latency.p99Ms}ms`,
      `  tokens:     ${tokenUnits}`,
      `  evidence:   ${dir}/`,
    ].join('\n'),
  );

  if (artifact.result !== 'PASS') process.exit(2);
}

main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
