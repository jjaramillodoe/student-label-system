import { Pool, type PoolClient, type QueryResultRow } from 'pg';

/**
 * MotherDuck via Postgres wire protocol (serverless-friendly).
 * @see https://motherduck.com/docs/key-tasks/authenticating-and-connecting-to-motherduck/postgres-endpoint/nodejs/
 */

const DEFAULT_HOST = 'pg.us-east-1-aws.motherduck.com';
const DEFAULT_DATABASE = 'student_label_analytics';

let pool: Pool | null = null;
let rootPool: Pool | null = null;

export function getMotherDuckToken(): string | undefined {
  return process.env.MOTHERDUCK_TOKEN?.trim() || undefined;
}

export function getMotherDuckHost(): string {
  return process.env.MOTHERDUCK_HOST?.trim() || DEFAULT_HOST;
}

/** Logical MotherDuck database name (without md: prefix). */
export function getMotherDuckDatabase(): string {
  const raw = process.env.MOTHERDUCK_DATABASE?.trim() || DEFAULT_DATABASE;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw)) {
    throw new Error('MOTHERDUCK_DATABASE must be a simple identifier (letters, numbers, underscore)');
  }
  return raw;
}

export function isMotherDuckConfigured(): boolean {
  return Boolean(getMotherDuckToken());
}

function createPool(database: string): Pool {
  const p = new Pool({
    host: getMotherDuckHost(),
    port: 5432,
    user: 'postgres',
    password: getMotherDuckToken(),
    database,
    ssl: { rejectUnauthorized: true },
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    query_timeout: 60_000,
  });
  p.on('error', (err) => {
    console.error('[motherduck] idle client error', err);
  });
  return p;
}

function getRootPool(): Pool {
  if (!isMotherDuckConfigured()) {
    throw new Error('MOTHERDUCK_TOKEN is not configured');
  }
  if (!rootPool) rootPool = createPool('md:');
  return rootPool;
}

export function getMotherDuckPool(): Pool {
  if (!isMotherDuckConfigured()) {
    throw new Error('MOTHERDUCK_TOKEN is not configured');
  }
  if (!pool) {
    pool = createPool(`md:${getMotherDuckDatabase()}`);
  }
  return pool;
}

export async function motherduckQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const { rows } = await getMotherDuckPool().query<T>(text, params);
  return rows;
}

export async function withMotherDuckClient<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getMotherDuckPool().connect();
  let destroy = false;
  try {
    return await fn(client);
  } catch (err) {
    destroy = true;
    throw err;
  } finally {
    client.release(destroy);
  }
}

/** Create analytics database + tables if missing. Safe to call on every sync. */
export async function ensureMotherDuckSchema(): Promise<void> {
  const db = getMotherDuckDatabase();
  await getRootPool().query(`CREATE DATABASE IF NOT EXISTS ${db}`);

  await motherduckQuery(`
    CREATE TABLE IF NOT EXISTS students (
      source_mongo_id VARCHAR PRIMARY KEY,
      student_id VARCHAR,
      label_id VARCHAR,
      first_name VARCHAR,
      last_name VARCHAR,
      dob VARCHAR,
      email VARCHAR,
      phone VARCHAR,
      school VARCHAR,
      fiscal_year VARCHAR,
      status VARCHAR,
      archived BOOLEAN,
      start_date VARCHAR,
      end_date VARCHAR,
      cabinet VARCHAR,
      drawer VARCHAR,
      drawer_section VARCHAR,
      program VARCHAR,
      intake_student_status VARCHAR,
      created_at VARCHAR,
      updated_at VARCHAR,
      synced_at TIMESTAMP
    )
  `);

  await motherduckQuery(`
    CREATE TABLE IF NOT EXISTS sync_meta (
      key VARCHAR PRIMARY KEY,
      value VARCHAR,
      updated_at TIMESTAMP
    )
  `);
}

export async function pingMotherDuck(): Promise<{ ok: boolean; latencyMs: number; message?: string; database?: string }> {
  if (!isMotherDuckConfigured()) {
    return { ok: false, latencyMs: 0, message: 'MOTHERDUCK_TOKEN is not set' };
  }
  const start = Date.now();
  try {
    await ensureMotherDuckSchema();
    await motherduckQuery('SELECT 1 AS ok');
    return {
      ok: true,
      latencyMs: Date.now() - start,
      database: getMotherDuckDatabase(),
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : 'MotherDuck ping failed',
      database: getMotherDuckDatabase(),
    };
  }
}
