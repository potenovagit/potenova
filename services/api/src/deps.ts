import { loadConfig, type PotenovaConfig } from '@potenova/config';
import {
  openDatabaseFromEnv,
  type PotenovaDb,
  EvidenceRepository,
  IdentityRepository,
  BillingRepository,
  ContentRepository,
  SafetyRepository,
  OperatorRepository,
  SessionRepository,
} from '@potenova/persistence';
import {
  AIGateway,
  ModelRegistry,
  AzureOpenAiChatProvider,
  type GenerativeProvider,
} from '@potenova/ai-gateway';

/** Everything the routes need: config + the shared database and its repositories. */
export interface Deps {
  readonly config: PotenovaConfig;
  readonly db: PotenovaDb;
  readonly identity: IdentityRepository;
  readonly evidence: EvidenceRepository;
  readonly billing: BillingRepository;
  readonly content: ContentRepository;
  readonly safety: SafetyRepository;
  readonly operator: OperatorRepository;
  readonly session: SessionRepository;
  /** AI candidate-evaluation plumbing (synthetic data only; AI-003). */
  readonly ai: AiDeps;
}

/**
 * AI gateway + the candidate model under evaluation. The provider is present
 * only when an in-region Azure OpenAI deployment is configured; otherwise the
 * eval route fails closed (503). The candidate is registered as SYNTHETIC_TESTING
 * — never APPROVED — so it can be reached only via the gateway's synthetic
 * evaluation path, never a production child route.
 */
export interface AiDeps {
  readonly gateway: AIGateway;
  readonly registry: ModelRegistry;
  readonly provider: GenerativeProvider | null;
  /** Registry id of the candidate model (the provider id), when configured. */
  readonly candidateModelId: string | null;
}

export interface BuildDepsOptions {
  readonly env?: NodeJS.ProcessEnv;
  /** Inject a database (tests pass an in-memory one); defaults to env POTENOVA_DB_DIR. */
  readonly db?: PotenovaDb;
  /** Inject a generative provider (tests pass an offline stub). */
  readonly aiProvider?: GenerativeProvider;
}

/** The capability envelope the candidate is evaluated within (synthetic Math). */
const EVAL_AGE_BANDS = ['g1-3', 'g4-6', 'g7-8'];
const EVAL_SUBJECTS = ['math'];
const EVAL_CAPABILITIES = ['task_generation'];

function buildAiDeps(env: NodeJS.ProcessEnv, injected?: GenerativeProvider): AiDeps {
  const registry = new ModelRegistry();
  let provider: GenerativeProvider | null = injected ?? null;

  if (!provider) {
    const endpoint = env.AZURE_OPENAI_ENDPOINT;
    const deployment = env.AZURE_OPENAI_DEPLOYMENT;
    const apiKey = env.AZURE_OPENAI_KEY;
    if (endpoint && deployment && apiKey) {
      provider = new AzureOpenAiChatProvider({
        endpoint,
        deployment,
        apiKey,
        region: env.AZURE_OPENAI_REGION ?? 'ca-east',
        apiVersion: env.AZURE_OPENAI_API_VERSION,
      });
    }
  }

  let candidateModelId: string | null = null;
  if (provider) {
    candidateModelId = provider.id;
    // Registered as a candidate — NOT approved for production routing.
    registry.register({
      modelId: provider.id,
      status: 'SYNTHETIC_TESTING',
      allowedRegions: [provider.region],
      ageBands: EVAL_AGE_BANDS,
      subjects: EVAL_SUBJECTS,
      capabilities: EVAL_CAPABILITIES,
      trainingDisabled: true,
    });
  }

  return { gateway: new AIGateway(registry), registry, provider, candidateModelId };
}

export function buildDeps(opts: BuildDepsOptions = {}): Deps {
  const env = opts.env ?? process.env;
  const config = loadConfig(env);
  const db = opts.db ?? openDatabaseFromEnv(env);
  return {
    config,
    db,
    identity: new IdentityRepository(db),
    evidence: new EvidenceRepository(db),
    billing: new BillingRepository(db),
    content: new ContentRepository(db),
    safety: new SafetyRepository(db),
    operator: new OperatorRepository(db),
    session: new SessionRepository(db),
    ai: buildAiDeps(env, opts.aiProvider),
  };
}

export const now = (): string => new Date().toISOString();
