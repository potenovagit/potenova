import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { ALL_DDL } from './schema';

/**
 * One Potenova database — a single PostgreSQL (PGlite in dev/test, managed
 * Postgres in prod) that every repository shares, mirroring how the running
 * service will hold one connection pool over many tables.
 */
export class PotenovaDb {
  readonly #pg: PGlite;
  readonly #db: PgliteDatabase;
  #ready: Promise<PgliteDatabase> | null = null;

  /** dataDir: a filesystem path to persist to, or undefined for in-memory (tests). */
  constructor(dataDir?: string) {
    this.#pg = dataDir ? new PGlite(dataDir) : new PGlite();
    this.#db = drizzle(this.#pg);
  }

  /** Ensure the schema exists (runs once) and return the query interface. */
  ready(): Promise<PgliteDatabase> {
    if (!this.#ready) this.#ready = this.#pg.exec(ALL_DDL).then(() => this.#db);
    return this.#ready;
  }

  async close(): Promise<void> {
    await this.#pg.close();
  }
}

export function openDatabase(dataDir?: string): PotenovaDb {
  return new PotenovaDb(dataDir);
}
