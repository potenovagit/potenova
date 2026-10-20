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
  ErasureRepository,
  RetentionRepository,
  SessionRepository,
  NotificationRepository,
} from '@potenova/persistence';
import {
  AIGateway,
  ModelRegistry,
  AzureOpenAiChatProvider,
  StubInputProvider,
  type GenerativeProvider,
  type InputProvider,
} from '@potenova/ai-gateway';
import {
  proposedRetentionPolicy,
  usageCapsPolicyFrom,
  emptyUsageCapsPolicy,
  type RetentionPolicy,
  type UsageCapsPolicy,
} from '@potenova/policy';
import { emptyEscalationMatrix, type EscalationMatrix } from '@potenova/safety';
import { type MasteryPolicy } from '@potenova/learner-state';
import {
  parseApprovals,
  masteryPolicyFrom,
  usageCapsFrom,
  escalationMatrixFromApproval,
  retentionPolicyFromApproval,
  type ApprovalsConfig,
} from './approvals';
import type { NotificationProvider } from './notification-delivery';

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
  readonly notifications: NotificationRepository;
  readonly erasure: ErasureRepository;
  /** Retention-sweep store (distinct from `policies.retention`, the schedule). */
  readonly retentionStore: RetentionRepository;
  readonly session: SessionRepository;
  /** AI candidate-evaluation plumbing (synthetic data only; AI-003). */
  readonly ai: AiDeps;
  /** Notification delivery provider — null until an approved, in-region provider
   *  is configured (EVIDENCE REQUIRED, residency/consent-bound). Delivery is
   *  fail-closed while null. */
  readonly notificationProvider: NotificationProvider | null;
  /** EVIDENCE-REQUIRED policy bundle enforced at the edge (ER-03/07/08/09). */
  readonly policies: PolicyDeps;
}

/**
 * The fail-closed policy bundle. In prod every policy must be approved or the
 * enforcing route refuses; in non-prod, configured-but-unapproved values let the
 * synthetic slice run. Usage caps are illustrative in non-prod and EMPTY in prod
 * (so prod fails closed until the child-safety expert's approved caps are loaded).
 */
export interface PolicyDeps {
  readonly isProd: boolean;
  readonly retention: RetentionPolicy;
  readonly usageCaps: UsageCapsPolicy;
  readonly escalation: EscalationMatrix;
  readonly mastery: MasteryPolicy;
}

/** Illustrative caps for non-prod only — clearly NOT approved (ER-09 pending). */
function stagingUsageCaps(): UsageCapsPolicy {
  const setBy = 'staging-illustrative (NOT approved — ER-09 pending)';
  return usageCapsPolicyFrom({
    primary: {
      caps: { maxContinuousMinutes: 20, maxDailyMinutes: 40, breakAfterMinutes: 10 },
      setBy,
      approved: false,
    },
    junior: {
      caps: { maxContinuousMinutes: 30, maxDailyMinutes: 60, breakAfterMinutes: 10 },
      setBy,
      approved: false,
    },
    intermediate: {
      caps: { maxContinuousMinutes: 40, maxDailyMinutes: 80, breakAfterMinutes: 10 },
      setBy,
      approved: false,
    },
  });
}

/**
 * The fail-closed policy bundle, with any signed approvals applied. An approval
 * flips its policy to an approved value (unblocking prod for that gate); absent
 * one, the policy stays DRAFT in non-prod and empty/fail-closed in prod.
 */
export function buildPolicies(isProd: boolean, approvals?: ApprovalsConfig): PolicyDeps {
  const approvedCaps = usageCapsFrom(approvals?.usageCaps);
  return {
    isProd,
    retention: retentionPolicyFromApproval(approvals?.retention) ?? proposedRetentionPolicy(),
    usageCaps: approvedCaps ?? (isProd ? emptyUsageCapsPolicy() : stagingUsageCaps()),
    escalation: escalationMatrixFromApproval(approvals?.escalation) ?? emptyEscalationMatrix(),
    mastery: masteryPolicyFrom(approvals?.mastery),
  };
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
  /** Multimodal input (STT/OCR). A non-prod default stub lets the synthetic slice
   *  run; prod is null until a real in-region provider is configured. */
  readonly inputProvider: InputProvider | null;
}

export interface BuildDepsOptions {
  readonly env?: NodeJS.ProcessEnv;
  /** Inject a database (tests pass an in-memory one); defaults to env POTENOVA_DB_DIR. */
  readonly db?: PotenovaDb;
  /** Inject a generative provider (tests pass an offline stub). */
  readonly aiProvider?: GenerativeProvider;
  /** Inject an input provider (tests pass an offline stub to drive the trust floor). */
  readonly inputProvider?: InputProvider;
  /** Inject a notification delivery provider (tests pass an offline stub). Null
   *  by default everywhere — no approved provider is wired (EVIDENCE REQUIRED). */
  readonly notificationProvider?: NotificationProvider;
  /** Signed policy approvals (else read from env POTENOVA_APPROVALS). Flips a
   *  policy to an approved value, unblocking prod for that gate. */
  readonly approvals?: ApprovalsConfig;
}

/** The capability envelope the candidate is evaluated within (synthetic Math). */
const EVAL_AGE_BANDS = ['g1-3', 'g4-6', 'g7-8'];
const EVAL_SUBJECTS = ['math'];
const EVAL_CAPABILITIES = ['task_generation'];

function buildAiDeps(
  env: NodeJS.ProcessEnv,
  isProd: boolean,
  injected?: GenerativeProvider,
  injectedInput?: InputProvider,
): AiDeps {
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

  // Non-prod default stub (high-confidence 'gt') so the synthetic multimodal slice
  // is runnable; prod stays null until a real in-region provider is configured.
  const inputProvider: InputProvider | null =
    injectedInput ?? (isProd ? null : new StubInputProvider({ text: 'gt', confidence: 0.9 }));

  return { gateway: new AIGateway(registry), registry, provider, candidateModelId, inputProvider };
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
    notifications: new NotificationRepository(db),
    erasure: new ErasureRepository(db),
    retentionStore: new RetentionRepository(db),
    session: new SessionRepository(db),
    ai: buildAiDeps(env, config.environment === 'prod', opts.aiProvider, opts.inputProvider),
    notificationProvider: opts.notificationProvider ?? null,
    policies: buildPolicies(config.environment === 'prod', opts.approvals ?? parseApprovals(env)),
  };
}

export const now = (): string => new Date().toISOString();
