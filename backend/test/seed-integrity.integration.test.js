import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { env } from '../src/config/env.js';
import { getPool, closePool } from '../src/config/db.js';
import { migrate, listMigrationFiles } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';
import { runIntegrityAudit } from '../src/services/integrity-audit.service.js';

const fixtureTicket = '90000000-0000-4000-8000-000000000003';
const tables = ['users', 'venues', 'events', 'ticket_types', 'orders', 'order_items', 'payments', 'tickets'];
async function snapshot(pool) {
  const result = {};
  for (const table of tables) result[table] = (await pool.query(
    `SELECT to_jsonb(row) AS value FROM ${table} row ORDER BY id`,
  )).rows.map(row => row.value);
  return result;
}

// Never seed or upgrade the caller's database: all work takes place in a fresh,
// randomly named database, dropped afterwards. Requires CREATEDB (CI has it).
test('existing commerce survives migrations and the demo USED fixture seeds consistently',
  { skip: !env.DATABASE_URL }, async t => {
    const originalUrl = env.DATABASE_URL;
    const admin = new pg.Pool({ connectionString: originalUrl });
    const database = 'nocturno_seed_check_' + randomUUID().replaceAll('-', '');
    let created = false;
    try {
      try { await admin.query(`CREATE DATABASE "${database}"`); created = true; }
      catch (error) {
        if (error.code === '42501') { t.skip('Isolated seed test requires CREATEDB'); return; }
        throw error;
      }
      const url = new URL(originalUrl);
      url.pathname = '/' + database;
      await closePool();
      env.DATABASE_URL = url.toString();
      const pool = getPool();
      await t.test('012 and 013 add constraints and audit storage without changing existing commercial rows', async () => {
        await pool.query('CREATE TABLE schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT NOW())');
        const oldFiles = (await listMigrationFiles()).filter(name => Number(name.slice(0, 3)) < 12);
        for (const name of oldFiles) {
          await pool.query(await readFile(new URL('../src/db/migrations/' + name, import.meta.url), 'utf8'));
          await pool.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
        }
        const [user, venue, event, type, order, item, payment, ticket] = Array.from({ length: 8 }, () => randomUUID());
        await pool.query(`INSERT INTO users(id,email,display_name) VALUES($1,$2,'Historical fixture')`, [user, user + '@example.test']);
        await pool.query(`INSERT INTO venues(id,name,slug,type,province,municipality,address)
          VALUES($1,'Historical venue',$2,'CLUB','Fixture','Fixture','Fixture street')`, [venue, 'history-' + venue]);
        await pool.query(`INSERT INTO events(id,venue_id,title,slug,event_type,starts_at,ends_at,status)
          VALUES($1,$2,'Historical event',$3,'CLUB',NOW()-interval '2 days',NOW()-interval '1 day','FINISHED')`, [event, venue, 'history-' + event]);
        await pool.query(`INSERT INTO ticket_types(id,event_id,name,price,quantity,sold) VALUES($1,$2,'General',14,10,1)`, [type, event]);
        await pool.query(`INSERT INTO orders(id,user_id,status,subtotal_cents,total_cents,idempotency_key,expires_at)
          VALUES($1,$2,'PAID',1400,1400,$3,NOW())`, [order, user, randomUUID()]);
        await pool.query(`INSERT INTO order_items(id,order_id,event_id,ticket_type_id,name,unit_price_cents,quantity,subtotal_cents,
          event_title_snapshot,venue_name_snapshot,starts_at_snapshot)
          VALUES($1,$2,$3,$4,'General',1400,1,1400,'Original event','Original venue',NOW()-interval '2 days')`, [item, order, event, type]);
        await pool.query(`INSERT INTO payments(id,order_id,provider,status,amount_cents,provider_payment_id)
          VALUES($1,$2,'STRIPE','PAID',1400,$3)`, [payment, order, 'pi_preserved_fixture_' + payment]);
        await pool.query(`INSERT INTO tickets(id,order_item_id,user_id,event_id,ticket_type_id,status,used_at)
          VALUES($1,$2,$3,$4,$5,'USED',NOW()-interval '2 days')`, [ticket, item, user, event, type]);
        const before = await snapshot(pool);
        await migrate();
        assert.deepEqual(await snapshot(pool), before);
        assert.equal((await pool.query('SELECT count(*)::int AS n FROM event_deletion_audit')).rows[0].n, 0);
        const constraints = await pool.query(`SELECT conname,convalidated FROM pg_constraint WHERE conname IN
          ('order_items_ticket_type_event_fk','tickets_order_item_event_type_fk','order_items_subtotal_matches_quantity')`);
        assert.equal(constraints.rowCount, 3);
        assert.ok(constraints.rows.every(row => !row.convalidated));
        await migrate();
        assert.deepEqual(await snapshot(pool), before, 'Re-running migrations is harmless');
      });
      await t.test('seed repairs only its known synthetic fixture, is idempotent and preserves history', async () => {
        await seed();
        let row = (await pool.query('SELECT issued_at,used_at,status FROM tickets WHERE id=$1', [fixtureTicket])).rows[0];
        assert.equal(row.status, 'USED');
        assert.equal(row.used_at.toISOString(), row.issued_at.toISOString());
        assert.equal((await runIntegrityAudit(pool)).errors, 0);
        await pool.query('UPDATE tickets SET used_at=NULL WHERE id=$1', [fixtureTicket]);
        const before = await snapshot(pool);
        await seed();
        const after = await snapshot(pool);
        for (const table of ['orders', 'order_items', 'payments']) assert.deepEqual(after[table], before[table], table);
        for (const old of before.tickets) {
          const current = after.tickets.find(ticket => ticket.id === old.id);
          assert.deepEqual(current, old.id === fixtureTicket ? { ...old, used_at: old.issued_at } : old);
        }
        // A real existing check-in timestamp is never overwritten, even on this demo UUID.
        await pool.query("UPDATE tickets SET used_at=issued_at+interval '1 minute' WHERE id=$1", [fixtureTicket]);
        row = (await pool.query('SELECT * FROM tickets WHERE id=$1', [fixtureTicket])).rows[0];
        // Another ticket with missing time must remain visible to the auditor, not auto-repaired.
        const other = '90000000-0000-4000-8000-000000000001';
        await pool.query("UPDATE tickets SET status='USED',used_at=NULL WHERE id=$1", [other]);
        await seed();
        assert.deepEqual((await pool.query('SELECT * FROM tickets WHERE id=$1', [fixtureTicket])).rows[0], row);
        assert.equal((await pool.query('SELECT used_at FROM tickets WHERE id=$1', [other])).rows[0].used_at, null);
        await pool.query("UPDATE tickets SET status='VALID' WHERE id=$1", [other]);
        const report = await runIntegrityAudit(pool);
        assert.equal(report.errors, 0, JSON.stringify(report.findings.filter(check => check.count)));
        assert.equal(report.warnings, 0);
      });
    } finally {
      await closePool();
      env.DATABASE_URL = originalUrl;
      if (created) await admin.query(`DROP DATABASE "${database}"`);
      await admin.end();
    }
  });
