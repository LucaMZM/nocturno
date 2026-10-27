import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, stat, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';
import { env } from '../src/config/env.js';
const exec = promisify(execFile);

// Credentials go only to the child environment, never to arguments or logs.
export async function backupCatalogueDatabase() {
  const url = new URL(env.DATABASE_URL);
  const directory = resolve('../.local-backups');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const filename = resolve(directory, `catalogue-before-${new Date().toISOString().replaceAll(':', '-')}.dump`);
  const binaries = process.platform === 'darwin' ? '/Applications/Postgres.app/Contents/Versions/18/bin/' : '';
  const childEnv = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432',
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password) };
  try {
    await exec(binaries + 'pg_dump', ['--format=custom', '--file=' + filename], { env: childEnv });
    await chmod(filename, 0o600);
    await exec(binaries + 'pg_restore', ['--file=/dev/null', filename], { env: childEnv });
    if ((await stat(filename)).size < 100) throw new Error('Empty backup');
  } catch {
    throw new Error('Backup could not be created and verified. Import cancelled; database unchanged.');
  }
  console.log('Verified database backup:', filename);
}
