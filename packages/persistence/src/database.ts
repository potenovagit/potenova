import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg'; // pg is CommonJS; default-import the value, type-import the class
import type { Pool as PgPoolType } from 'pg';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { ALL_DDL } from './schema';

const { Pool } = pg;

/**
 * One Potenova database — a single PostgreSQL that every repository shares,
 * mirroring how the running service holds one connection pool over many tables.
 *
 * Two interchangeable backends behind one interface (ADR-0017):
 *   - PGlite (Postgres compiled to WASM) for dev/test — zero install, in-process.
 *   - node-postgres against a managed Postgres (Azure, Canadian region) for prod.
 * The schema (ALL_DDL) and every repository are identical across both — only the
 * connection changes. The repositories depend on `PotenovaDrizzle`, the Postgres
 * query interface both backends implement, so none of them know which is in use.
 */
export type PotenovaDrizzle = PgDatabase<any, any, any>;

export interface PgliteOptions {
  readonly kind?: 'pglite';
  /** Filesystem path to persist to, or undefined for in-memory (tests). */
  readonly dataDir?: string;
}
export interface PostgresOptions {
  readonly kind: 'postgres';
  readonly connectionString: string;
  /** TLS to the server. Managed Postgres (Azure) requires it; local dev may not. */
  readonly ssl?: boolean;
}
export type DatabaseOptions = PgliteOptions | PostgresOptions;

export class PotenovaDb {
  readonly #backend: 'pglite' | 'postgres';
  readonly #pg?: PGlite;
  readonly #pool?: PgPoolType;
  readonly #db: PotenovaDrizzle;
  #ready: Promise<PotenovaDrizzle> | null = null;

  constructor(options?: DatabaseOptions | string) {
    const opts: DatabaseOptions =
      typeof options === 'string'
        ? { kind: 'pglite', dataDir: options }
        : (options ?? { kind: 'pglite' });

    if (opts.kind === 'postgres') {
      this.#backend = 'postgres';
      this.#pool = new Pool({
        connectionString: opts.connectionString,
        ssl: opts.ssl ? { rejectUnauthorized: true } : false,
      });
      this.#db = drizzleNodePg(this.#pool);
    } else {
      this.#backend = 'pglite';
      this.#pg = opts.dataDir ? new PGlite(opts.dataDir) : new PGlite();
      this.#db = drizzlePglite(this.#pg);
    }
  }

  /** Which backend is in use — for logging and health reporting, never for logic. */
  get backend(): 'pglite' | 'postgres' {
    return this.#backend;
  }

  /** Ensure the schema exists (runs once) and return the query interface. */
  ready(): Promise<PotenovaDrizzle> {
    return (this.#ready ??= this.#applySchema());
  }

  #applySchema(): Promise<PotenovaDrizzle> {
    const applied =
      this.#backend === 'postgres'
        ? this.#pool!.query(ALL_DDL).then(() => undefined)
        : this.#pg!.exec(ALL_DDL).then(() => undefined);
    return applied.then(() => this.#db);
  }

  async close(): Promise<void> {
    if (this.#backend === 'postgres') await this.#pool!.end();
    else await this.#pg!.close();
  }
}

export function openDatabase(options?: DatabaseOptions | string): PotenovaDb {
  return new PotenovaDb(options);
}

/**
 * Choose a backend from the environment:
 *   - DATABASE_URL set    -> managed Postgres (production; TLS on unless DATABASE_SSL=false)
 *   - POTENOVA_DB_DIR set -> on-disk PGlite (local persistence)
 *   - neither             -> in-memory PGlite (tests, quick dev)
 */
export function openDatabaseFromEnv(env: NodeJS.ProcessEnv = process.env): PotenovaDb {
  if (env.DATABASE_URL) {
    return new PotenovaDb({
      kind: 'postgres',
      connectionString: env.DATABASE_URL,
      ssl: env.DATABASE_SSL !== 'false',
    });
  }
  return new PotenovaDb({ kind: 'pglite', dataDir: env.POTENOVA_DB_DIR || undefined });
}
