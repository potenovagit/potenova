import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AIGateway,
  ModelRegistry,
  AzureOpenAiChatProvider,
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
 * CLI: run the synthetic model-evaluation suite against the live in-Canada Azure
 * OpenAI deployment and write a gate-ready evidence artifact.
 *
 *   AZURE_OPENAI_ENDPOINT=... AZURE_OPENAI_DEPLOYMENT=tutor-mini \
 *   AZURE_OPENAI_KEY=... npm run eval:model
 *
 * Synthetic data only; nothing is delivered to a child. Fails closed if the
 * provider is not configured or the region is not Canadian. Writes to
 * evidence/<gate>/<req-id>/<run-id>/{report.json,summary.md}.
 */

const VALIDATOR_ID = 'math-oracle:fractions';
const VALIDATOR_VERSION = 'v1';

function fail(msg: string): never {
  // eslint-disable-next-line no-console
  console.error(`eval:model — ${msg}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiKey = process.env.AZURE_OPENAI_KEY;
  const region = process.env.AZURE_OPENAI_REGION ?? 'ca-east';
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

  if (!endpoint || !deployment || !apiKey) {
    fail('set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT and AZURE_OPENAI_KEY');
  }

  const provider: GenerativeProvider = new AzureOpenAiChatProvider({
    endpoint,
    deployment,
    apiKey,
    region,
    apiVersion,
  });

  // Fail-closed gateway gate: synthetic-only, Canadian region, model in registry.
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
  new AIGateway(registry).routeForEvaluation(provider.id, {
    synthetic: true,
    processingRegion: provider.region,
  });

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
    apiVersion,
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
      `  model:      ${artifact.model} (${artifact.processingRegion})`,
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
