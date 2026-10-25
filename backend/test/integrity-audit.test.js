import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { getPool, closePool } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { integrityChecks, runIntegrityAudit } from '../src/services/integrity-audit.service.js';

test('integrity audit opens a read-only stable snapshot and reports identifiers without repairs', async () => {
  const statements = [];
  let released = false;
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql.startsWith('SELECT name FROM schema_migrations')) return { rows: [{ name: '012_integrity_constraints.sql' }] };
      if (sql.startsWith('WITH violations')) return { rows: [{ count: sql.includes('deleted_at IS NOT NULL') ? '1' : '0', samples: [] }] };
      return { rows: [] };
    },
    release() { released = true; },
  };
  const report = await runIntegrityAudit({ connect: async () => client });
  assert.equal(statements[0], 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal(statements.at(-1), 'COMMIT');
  assert.equal(released, true);
  assert.equal(report.readOnly, true);
  assert.equal(report.errors, 1);
  assert.equal(report.findings.length, integrityChecks.length);
  for (const sql of statements) assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|ALTER|TRUNCATE)\b/);
});

test('integrity audit rolls back and releases its connection on query failure', async () => {
  const statements = [];
  let released = false;
  const client = {
    async query(sql) { statements.push(sql); if (sql.startsWith('SELECT name')) throw new Error('fixture'); return { rows: [] }; },
    release() { released = true; },
  };
  await assert.rejects(runIntegrityAudit({ connect: async () => client }), /fixture/);
  assert.equal(statements.at(-1), 'ROLLBACK');
  assert.equal(released, true);
});

test('incremental integrity constraints reject mismatched relations and arithmetic without modifying legacy rows',
  { skip: !env.DATABASE_URL }, async () => {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const namespace = `integrity_${randomUUID().replaceAll('-', '')}`;
      await client.query(`CREATE SCHEMA ${namespace}`);
      await client.query(`SET LOCAL search_path TO ${namespace}, public`);
      // Minimal isolated copies make the migration test independent of demo data.
      await client.query(`CREATE TABLE ticket_types (id uuid PRIMARY KEY, event_id uuid NOT NULL);
        CREATE TABLE order_items (id uuid PRIMARY KEY, event_id uuid NOT NULL, ticket_type_id uuid NOT NULL,
          subtotal_cents bigint NOT NULL, unit_price_cents bigint NOT NULL, quantity integer NOT NULL);
        CREATE TABLE tickets (id uuid PRIMARY KEY, order_item_id uuid NOT NULL, event_id uuid NOT NULL, ticket_type_id uuid NOT NULL);
        CREATE TABLE orders (id uuid PRIMARY KEY, currency char(3));
        CREATE TABLE payments (id uuid PRIMARY KEY, currency char(3));
        CREATE TABLE event_waitlist (id uuid PRIMARY KEY, user_id uuid);`);
      const [type, eventA, eventB, item] = Array.from({ length: 4 }, () => randomUUID());
      await client.query('INSERT INTO ticket_types VALUES ($1,$2)', [type, eventA]);
      // Deliberately invalid historical data must survive migration unchanged.
      await client.query('INSERT INTO order_items VALUES ($1,$2,$3,999,100,2)', [item, eventB, type]);
      const migration = await readFile(new URL('../src/db/migrations/012_integrity_constraints.sql', import.meta.url), 'utf8');
      await client.query(migration);
      const legacy = (await client.query('SELECT * FROM order_items WHERE id = $1', [item])).rows[0];
      assert.equal(legacy.event_id, eventB);
      assert.equal(legacy.subtotal_cents, '999');
      async function rejectStatement(sql, values, code) {
        await client.query('SAVEPOINT invalid_write');
        await assert.rejects(() => client.query(sql, values), { code });
        await client.query('ROLLBACK TO SAVEPOINT invalid_write');
      }
      await rejectStatement('INSERT INTO order_items VALUES ($1,$2,$3,200,100,2)',
        [randomUUID(), eventB, type], '23503');
      await rejectStatement('INSERT INTO order_items VALUES ($1,$2,$3,199,100,2)',
        [randomUUID(), eventA, type], '23514');
      const validItem = randomUUID();
      await client.query('INSERT INTO order_items VALUES ($1,$2,$3,200,100,2)', [validItem, eventA, type]);
      await rejectStatement('INSERT INTO tickets VALUES ($1,$2,$3,$4)',
        [randomUUID(), validItem, eventB, type], '23503');
      await client.query('INSERT INTO tickets VALUES ($1,$2,$3,$4)', [randomUUID(), validItem, eventA, type]);
      await rejectStatement('INSERT INTO orders VALUES ($1,$2)', [randomUUID(), 'eur'], '23514');
      assert.equal((await client.query(`SELECT count(*)::int AS count FROM pg_constraint
        WHERE connamespace = $1::regnamespace AND NOT convalidated`, [namespace])).rows[0].count, 5);
    } finally {
      await client.query('ROLLBACK');
      client.release();
      await closePool();
    }
  });

test('integrity audit executes every diagnostic and PostgreSQL catalog query against the migrated database',
  { skip: !env.DATABASE_URL }, async () => {
    try {
      const report = await runIntegrityAudit(getPool());
      assert.equal(report.readOnly, true);
      assert.ok(report.migrations.includes('012_integrity_constraints.sql'));
      const foreignKeys = report.constraints.filter((item) => item.type === 'f');
      assert.ok(foreignKeys.length > 0);
      for (const foreignKey of foreignKeys) {
        assert.ok(Array.isArray(foreignKey.columns));
        assert.ok(Array.isArray(foreignKey.referenced_columns));
        assert.ok(report.findings.some((finding) => finding.code === `ORPHAN:${foreignKey.name}`));
      }
      assert.ok(report.findings.length > integrityChecks.length);
      assert.ok(report.columns.some((column) => column.table_name === 'orders' && column.column_name === 'total_cents'));
    } finally { await closePool(); }
  });
