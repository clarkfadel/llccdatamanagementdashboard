import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

export const SCHEMA = process.env.DB_SCHEMA || 'public';

// pg returns bigint as string, convert to number
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

// use DATABASE_URL on the server, PG* vars for local
function buildConfig() {
  const ssl = /^(1|true|require)$/i.test(process.env.PGSSL || '')
    ? { rejectUnauthorized: false }
    : undefined;

  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL, ssl };
  }
  return {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl,
  };
}

export const pool = new Pool({
  ...buildConfig(),
  max: 10,
  idleTimeoutMillis: 30_000,
});

// show which db we're connected to (no password)
export function describeTarget() {
  if (process.env.DATABASE_URL) {
    try {
      const u = new URL(process.env.DATABASE_URL);
      return `${u.hostname}:${u.port || 5432}/${u.pathname.replace('/', '')}`;
    } catch {
      return 'DATABASE_URL';
    }
  }
  const host = process.env.PGHOST || 'localhost';
  const port = process.env.PGPORT || 5432;
  const db = process.env.PGDATABASE || '';
  return `${host}:${port}/${db}`;
}

export function query(text, params) {
  return pool.query(text, params);
}

// run queries in a transaction, rollback if something fails
export async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const q = (text, params) => client.query(text, params);
    const out = await fn(q);
    await client.query('commit');
    return out;
  } catch (e) {
    try { await client.query('rollback'); } catch {}
    throw e;
  } finally {
    client.release();
  }
}
