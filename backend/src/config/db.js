import pg from 'pg';
import { requireDatabaseUrl } from './env.js';

let pool;
export function getPool() {
  if (!pool) pool = new pg.Pool({ connectionString: requireDatabaseUrl() });
  return pool;
}
export async function closePool() {
  if (pool) await pool.end();
  pool = undefined;
}
