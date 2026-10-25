/** Read-only diagnostics. Never repairs, deletes or validates legacy rows. */
export const integrityChecks = [
  { code: 'EVENT_DELETED_ACTIVE', sql: `SELECT id FROM events WHERE deleted_at IS NOT NULL AND is_active` },
  { code: 'EVENT_INVALID_DATES', sql: `SELECT id FROM events WHERE ends_at <= starts_at` },
  { code: 'VENUE_INVALID_COORDINATES', sql: `SELECT id FROM venues WHERE latitude NOT BETWEEN -90 AND 90
    OR longitude NOT BETWEEN -180 AND 180 OR (latitude IS NULL) <> (longitude IS NULL)` },
  { code: 'PROMOTER_USER_UNASSIGNED', sql: `SELECT id FROM users WHERE role = 'PROMOTER' AND promoter_id IS NULL` },
  { code: 'TICKET_TYPE_INVALID_STOCK', sql: `SELECT id FROM ticket_types WHERE quantity < 0 OR sold < 0
    OR reserved < 0 OR sold::bigint + reserved > quantity` },
  { code: 'TICKET_TYPE_INVALID_PRICE', sql: `SELECT id FROM ticket_types WHERE price < 0 OR price::text IN ('NaN','Infinity','-Infinity')` },
  { code: 'ORDER_ITEM_EVENT_MISMATCH', sql: `SELECT oi.id FROM order_items oi JOIN ticket_types tt ON tt.id = oi.ticket_type_id
    WHERE oi.event_id <> tt.event_id` },
  { code: 'ORDER_ITEM_AMOUNT_MISMATCH', sql: `SELECT id FROM order_items WHERE quantity <= 0 OR unit_price_cents < 0
    OR subtotal_cents::numeric <> unit_price_cents::numeric * quantity` },
  { code: 'ORDER_TOTAL_MISMATCH', sql: `SELECT o.id FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
    GROUP BY o.id HAVING count(oi.id) = 0 OR o.subtotal_cents <> coalesce(sum(oi.subtotal_cents),0)
    OR o.total_cents <> o.subtotal_cents` },
  { code: 'ORDER_MISSING_PAYMENT', sql: `SELECT o.id FROM orders o LEFT JOIN payments p ON p.order_id = o.id WHERE p.id IS NULL AND o.total_cents > 0` },
  { code: 'PAYMENT_AMOUNT_MISMATCH', sql: `SELECT p.id FROM payments p JOIN orders o ON o.id = p.order_id
    WHERE p.amount_cents <> o.total_cents OR p.currency <> o.currency` },
  { code: 'PAYMENT_ORDER_STATE_MISMATCH', sql: `SELECT p.id FROM payments p JOIN orders o ON o.id = p.order_id
    WHERE (p.status = 'PAID' AND o.status <> 'PAID') OR (p.status = 'REFUNDED' AND o.status <> 'REFUNDED')
    OR (o.status = 'PAID' AND p.status <> 'PAID') OR (o.status = 'REFUNDED' AND p.status <> 'REFUNDED')` },
  { code: 'TICKET_RELATION_MISMATCH', sql: `SELECT t.id FROM tickets t JOIN order_items oi ON oi.id = t.order_item_id
    JOIN orders o ON o.id = oi.order_id WHERE t.event_id <> oi.event_id OR t.ticket_type_id <> oi.ticket_type_id
    OR t.user_id <> o.user_id` },
  { code: 'TICKET_COUNT_MISMATCH', sql: `SELECT oi.id FROM order_items oi JOIN orders o ON o.id = oi.order_id
    LEFT JOIN tickets t ON t.order_item_id = oi.id WHERE o.status IN ('PAID','REFUNDED') GROUP BY oi.id
    HAVING count(t.id) <> oi.quantity` },
  { code: 'TICKET_ORDER_STATE_MISMATCH', sql: `SELECT t.id FROM tickets t JOIN order_items oi ON oi.id = t.order_item_id
    JOIN orders o ON o.id = oi.order_id WHERE (t.status IN ('VALID','USED') AND o.status <> 'PAID')
    OR (o.status = 'REFUNDED' AND t.status <> 'REFUNDED')` },
  { code: 'TICKET_USED_WITHOUT_TIMESTAMP', sql: `SELECT id FROM tickets WHERE status = 'USED' AND used_at IS NULL` },
  { code: 'TICKET_VALID_WITH_USED_TIMESTAMP', sql: `SELECT id FROM tickets WHERE status = 'VALID' AND used_at IS NOT NULL` },
  { code: 'SOLD_COUNTER_MISMATCH', sql: `SELECT tt.id FROM ticket_types tt LEFT JOIN
    (SELECT oi.ticket_type_id, sum(oi.quantity) AS sold FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status = 'PAID' GROUP BY oi.ticket_type_id) s ON s.ticket_type_id = tt.id
    WHERE tt.sold <> coalesce(s.sold,0)` },
  { code: 'RESERVED_COUNTER_MISMATCH', sql: `SELECT tt.id FROM ticket_types tt LEFT JOIN
    (SELECT oi.ticket_type_id, sum(oi.quantity) AS reserved FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status = 'AWAITING_PAYMENT' GROUP BY oi.ticket_type_id) r ON r.ticket_type_id = tt.id
    WHERE tt.reserved <> coalesce(r.reserved,0)` },
  { code: 'EXPIRED_RESERVATION_PENDING', severity: 'warning', sql: `SELECT id FROM orders
    WHERE status = 'AWAITING_PAYMENT' AND expires_at < NOW()` },
  { code: 'CART_ITEM_UNAVAILABLE', severity: 'warning', sql: `SELECT ci.id FROM cart_items ci
    JOIN ticket_types tt ON tt.id = ci.ticket_type_id JOIN events e ON e.id = tt.event_id
    WHERE NOT tt.active OR NOT e.is_active OR e.deleted_at IS NOT NULL OR e.status <> 'PUBLISHED'
    OR e.ends_at <= NOW() OR ci.quantity > tt.quantity - tt.sold - tt.reserved
    OR (tt.max_per_user IS NOT NULL AND ci.quantity > tt.max_per_user)
    OR tt.sales_start > NOW() OR tt.sales_end <= NOW()` },
];

const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;

export async function runIntegrityAudit(pool) {
  const client = await pool.connect();
  try {
    // One stable committed snapshot avoids false mismatches during webhook writes.
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query('SET LOCAL search_path = pg_catalog, public');
    await client.query("SET LOCAL statement_timeout = '30s'");
    const { rows: migrations } = await client.query('SELECT name FROM schema_migrations ORDER BY name');
    const { rows: constraints } = await client.query(`SELECT c.conname AS name, c.contype AS type,
      c.convalidated AS validated, c.conrelid::regclass::text AS table_name,
      pg_get_constraintdef(c.oid) AS definition, pg_get_expr(c.conbin, c.conrelid) AS expression,
      CASE WHEN c.contype = 'f' THEN c.confrelid::regclass::text END AS referenced_table,
      (SELECT array_agg(a.attname::text ORDER BY k.ordinality) FROM unnest(c.conkey) WITH ORDINALITY k(num,ordinality)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.num) AS columns,
      (SELECT array_agg(a.attname::text ORDER BY k.ordinality) FROM unnest(c.confkey) WITH ORDINALITY k(num,ordinality)
        JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.num) AS referenced_columns
      FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' ORDER BY c.conrelid::regclass::text, c.conname`);
    const { rows: indexes } = await client.query(`SELECT tablename AS table_name, indexname AS name,
      indexdef AS definition FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname`);
    const { rows: columns } = await client.query(`SELECT table_name, column_name, data_type, is_nullable,
      numeric_precision, numeric_scale FROM information_schema.columns WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position`);
    const findings = [];
    async function inspect(code, sql, severity = 'error') {
      const { rows: [result] } = await client.query(`WITH violations AS (${sql})
        SELECT (SELECT count(*)::text FROM violations) AS count,
        (SELECT coalesce(json_agg(sample), '[]'::json) FROM
          (SELECT id FROM violations ORDER BY id LIMIT 20) sample) AS samples`);
      findings.push({ code, severity, count: Number(result.count), samples: result.samples });
    }
    for (const check of integrityChecks) await inspect(check.code, check.sql, check.severity);
    // Inspect ALL declared FKs, including NOT VALID legacy rows, without exposing PII.
    for (const fk of constraints.filter((item) => item.type === 'f')) {
      const table = quoteIdentifier(fk.table_name);
      const parent = quoteIdentifier(fk.referenced_table);
      const matches = fk.columns.map((column, i) =>
        `p.${quoteIdentifier(fk.referenced_columns[i])} = c.${quoteIdentifier(column)}`).join(' AND ');
      const nonNull = fk.columns.map((column) => `c.${quoteIdentifier(column)} IS NOT NULL`).join(' AND ');
      const identifier = fk.columns.map((column) => `c.${quoteIdentifier(column)}::text`).join(" || ':' || ");
      await inspect(`ORPHAN:${fk.name}`, `SELECT ${identifier} AS id FROM ${table} c
        WHERE ${nonNull} AND NOT EXISTS (SELECT 1 FROM ${parent} p WHERE ${matches})`);
    }
    for (const check of constraints.filter((item) => item.type === 'c' && !item.validated)) {
      await inspect(`LEGACY_CHECK:${check.name}`,
        `SELECT to_jsonb(c)->>'id' AS id FROM ${quoteIdentifier(check.table_name)} c WHERE NOT (${check.expression})`);
    }
    await client.query('COMMIT');
    const errors = findings.filter((item) => item.severity === 'error' && item.count > 0).length;
    const warnings = findings.filter((item) => item.severity === 'warning' && item.count > 0).length;
    return { readOnly: true, generatedAt: new Date().toISOString(), errors, warnings,
      migrations: migrations.map((item) => item.name), constraints, indexes, columns, findings };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
