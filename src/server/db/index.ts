import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

export interface QueryExecutor {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
}

export interface DatabaseClient extends QueryExecutor {
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: QueryExecutor) => Promise<T>): Promise<T>;
  migrate(): Promise<void>;
  close(): Promise<void>;
  readonly engine: 'pg' | 'pglite';
}

export interface CreateDatabaseOptions {
  databaseUrl?: string;
  dataDir?: string;
}

export async function createDatabase(
  options: CreateDatabaseOptions = {}
): Promise<DatabaseClient> {
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;

  if (databaseUrl && databaseUrl.startsWith('postgres')) {
    const pool = new pg.Pool({ connectionString: databaseUrl });

    const client: DatabaseClient = {
      engine: 'pg',
      async query<T = Record<string, unknown>>(
        sql: string,
        params: unknown[] = []
      ): Promise<QueryResult<T>> {
        const res = await pool.query(sql, params);
        return {
          rows: res.rows as T[],
          rowCount: res.rowCount ?? res.rows.length,
        };
      },
      async exec(sql: string): Promise<void> {
        await pool.query(sql);
      },
      async transaction<T>(fn: (tx: QueryExecutor) => Promise<T>): Promise<T> {
        const conn = await pool.connect();
        try {
          await conn.query('BEGIN');
          const tx: QueryExecutor = {
            async query<R = Record<string, unknown>>(
              sql: string,
              params: unknown[] = []
            ): Promise<QueryResult<R>> {
              const r = await conn.query(sql, params);
              return {
                rows: r.rows as R[],
                rowCount: r.rowCount ?? r.rows.length,
              };
            },
          };
          const out = await fn(tx);
          await conn.query('COMMIT');
          return out;
        } catch (err) {
          await conn.query('ROLLBACK');
          throw err;
        } finally {
          conn.release();
        }
      },
      async migrate(): Promise<void> {
        await runMigrations(this);
      },
      async close(): Promise<void> {
        await pool.end();
      },
    };

    await client.migrate();
    return client;
  }

  // Embedded real PostgreSQL 16 via PGlite
  const rawDir =
    options.dataDir ??
    process.env.PGLITE_DATA_DIR ??
    path.resolve(process.cwd(), 'data/pgdata');

  let pglite: PGlite;
  if (rawDir === 'memory://' || rawDir === ':memory:') {
    pglite = new PGlite();
  } else {
    fs.mkdirSync(rawDir, { recursive: true });
    pglite = new PGlite(rawDir);
  }

  // Serialize transactions on PGlite single-connection engine
  let txLock: Promise<unknown> = Promise.resolve();

  const client: DatabaseClient = {
    engine: 'pglite',
    async query<T = Record<string, unknown>>(
      sql: string,
      params: unknown[] = []
    ): Promise<QueryResult<T>> {
      const res = await pglite.query<T>(sql, params);
      return {
        rows: res.rows,
        rowCount: res.affectedRows ?? res.rows.length,
      };
    },
    async exec(sql: string): Promise<void> {
      await pglite.exec(sql);
    },
    async transaction<T>(fn: (tx: QueryExecutor) => Promise<T>): Promise<T> {
      const run = async (): Promise<T> => {
        return await pglite.transaction(async (pgTx) => {
          const tx: QueryExecutor = {
            async query<R = Record<string, unknown>>(
              sql: string,
              params: unknown[] = []
            ): Promise<QueryResult<R>> {
              const r = await pgTx.query<R>(sql, params);
              return {
                rows: r.rows,
                rowCount: r.affectedRows ?? r.rows.length,
              };
            },
          };
          return await fn(tx);
        });
      };
      const next = txLock.then(run, run);
      txLock = next.catch(() => undefined);
      return next;
    },
    async migrate(): Promise<void> {
      await runMigrations(this);
    },
    async close(): Promise<void> {
      await pglite.close();
    },
  };

  await client.migrate();
  return client;
}

async function runMigrations(db: DatabaseClient): Promise<void> {
  const migrationsDir = path.resolve(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  for (const file of files) {
    const existing = await db.query<{ version: string }>(
      'SELECT version FROM schema_migrations WHERE version = $1',
      [file]
    );
    if (existing.rows.length > 0) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await db.exec(sql);
    await db.query(
      'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING',
      [file]
    );
  }
}
