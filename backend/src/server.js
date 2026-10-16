import { app } from './app.js';
import { env, requireAuthSecrets } from './config/env.js';
import { getPool, closePool } from './config/db.js';
import { checkoutService } from './services/checkout.service.js';

try {
  requireAuthSecrets();
  const connection = await getPool().connect();
  connection.release();
  const server = app.listen(env.PORT, () => console.log(`Nocturno API listening on http://localhost:${env.PORT}`));
  let expiring = false;
  const expiryTimer = setInterval(async () => {
    if (expiring) return;
    expiring = true;
    try { await checkoutService.expireStaleOrders(); }
    catch (error) { console.error('Order expiration failed', error.code ?? error.message); }
    finally { expiring = false; }
  }, 60_000);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    clearInterval(expiryTimer);
    server.close(async () => { await closePool(); process.exit(0); });
  });
} catch (error) {
  console.error('Cannot start API:', error);
  process.exitCode = 1;
  await closePool();
}
