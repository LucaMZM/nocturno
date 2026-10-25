import { getPool, closePool } from '../src/config/db.js';
import { runIntegrityAudit } from '../src/services/integrity-audit.service.js';

try {
  const report = await runIntegrityAudit(getPool());
  console.log(JSON.stringify(report, null, 2));
  if (report.errors) process.exitCode = 1;
} catch {
  // Connection strings and driver errors may contain credentials.
  console.error('Integrity audit failed. Check database connectivity and applied migrations. No data was changed.');
  process.exitCode = 2;
} finally { await closePool(); }
