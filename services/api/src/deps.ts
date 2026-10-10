import { loadConfig, type PotenovaConfig } from '@potenova/config';
import {
  openDatabase,
  type PotenovaDb,
  EvidenceRepository,
  IdentityRepository,
  BillingRepository,
  ContentRepository,
  SafetyRepository,
  OperatorRepository,
  SessionRepository,
} from '@potenova/persistence';

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
}

export interface BuildDepsOptions {
  readonly env?: NodeJS.ProcessEnv;
  /** Inject a database (tests pass an in-memory one); defaults to env POTENOVA_DB_DIR. */
  readonly db?: PotenovaDb;
}

export function buildDeps(opts: BuildDepsOptions = {}): Deps {
  const config = loadConfig(opts.env ?? process.env);
  const db = opts.db ?? openDatabase(process.env.POTENOVA_DB_DIR || undefined);
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
  };
}

export const now = (): string => new Date().toISOString();
