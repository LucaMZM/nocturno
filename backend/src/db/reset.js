import { fileURLToPath } from 'node:url';
import { env, requireDatabaseUrl } from '../config/env.js';
import { getPool, closePool } from '../config/db.js';
import { migrate } from './migrate.js';

export async function reset() {
  if (env.NODE_ENV === 'production') throw new Error('db:reset is disabled in production');
  if (new URL(requireDatabaseUrl()).pathname !== '/nocturno') throw new Error('db:reset only allows the nocturno database');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('DROP TABLE IF EXISTS favorites, ticket_types, events, venues, promoters, users, schema_migrations');
    await client.query('DROP FUNCTION IF EXISTS set_updated_at()');
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  await migrate();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { await reset(); console.log('Nocturno schema reset'); } catch (error) { console.error(error); process.exitCode = 1; } finally { await closePool(); }
}
