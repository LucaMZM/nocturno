import { getPool } from '../config/db.js';

// Fixed SQL only. Fingerprints detect replacements and updates, not just count changes.
const relations = {
  ticketTypes: `SELECT id, event_id, quantity, sold, reserved, active, updated_at FROM ticket_types WHERE event_id=$1`,
  activeTicketTypes: `SELECT id, updated_at FROM ticket_types WHERE event_id=$1 AND active=TRUE`,
  orderItems: `SELECT oi.* FROM order_items oi WHERE oi.event_id=$1 OR oi.ticket_type_id IN (SELECT id FROM ticket_types WHERE event_id=$1)`,
  orders: `SELECT o.* FROM orders o WHERE o.id IN (SELECT order_id FROM order_items WHERE event_id=$1 OR ticket_type_id IN (SELECT id FROM ticket_types WHERE event_id=$1))`,
  payments: `SELECT p.* FROM payments p WHERE p.order_id IN (SELECT order_id FROM order_items WHERE event_id=$1 OR ticket_type_id IN (SELECT id FROM ticket_types WHERE event_id=$1))`,
  tickets: `SELECT t.* FROM tickets t WHERE t.event_id=$1 OR t.ticket_type_id IN (SELECT id FROM ticket_types WHERE event_id=$1) OR t.order_item_id IN (SELECT id FROM order_items WHERE event_id=$1)`,
  favorites: `SELECT user_id, event_id, created_at FROM favorites WHERE event_id=$1`,
  cartItems: `SELECT ci.* FROM cart_items ci JOIN ticket_types tt ON tt.id=ci.ticket_type_id WHERE tt.event_id=$1`,
  waitlist: `SELECT id, event_id, user_id, created_at FROM event_waitlist WHERE event_id=$1`,
  images: `SELECT * FROM event_images WHERE event_id=$1`,
  embeddings: `SELECT event_id, model_key, document_hash, indexed_at FROM yomogan_embeddings WHERE event_id=$1`,
};

export const eventDeletionRepository = {
  async snapshot(client, eventId, lock = false) {
    const { rows } = await client.query(
      `SELECT * FROM events WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [eventId]);
    if (!rows[0]) return null;
    if (lock) await client.query('SELECT id FROM ticket_types WHERE event_id=$1 ORDER BY id FOR UPDATE', [eventId]);
    const counts = {}, fingerprints = {};
    for (const [key, sql] of Object.entries(relations)) {
      // Only aggregate IDs/state reach the service; customer data is not part of the preview.
      const { rows: [row] } = await client.query(`SELECT count(*)::integer AS count,
        md5(coalesce(string_agg(to_jsonb(dependency)::text, '|' ORDER BY to_jsonb(dependency)::text),'')) AS fingerprint
        FROM (${sql}) dependency`, [eventId]);
      counts[key] = row.count;
      fingerprints[key] = row.fingerprint;
    }
    const { rows: [integrity] } = await client.query(`SELECT
      EXISTS (SELECT 1 FROM ticket_types t WHERE t.event_id=$1 AND
        (t.sold <> coalesce((SELECT sum(oi.quantity) FROM order_items oi JOIN orders o ON o.id=oi.order_id
            WHERE oi.ticket_type_id=t.id AND o.status='PAID'),0)
         OR t.reserved <> coalesce((SELECT sum(oi.quantity) FROM order_items oi JOIN orders o ON o.id=oi.order_id
            WHERE oi.ticket_type_id=t.id AND o.status='AWAITING_PAYMENT'),0)
         OR t.sold+t.reserved>t.quantity)) AS stock_mismatch,
      EXISTS (SELECT 1 FROM order_items oi JOIN ticket_types tt ON tt.id=oi.ticket_type_id
        WHERE (oi.event_id=$1 OR tt.event_id=$1) AND oi.event_id<>tt.event_id)
      OR EXISTS (SELECT 1 FROM tickets t JOIN order_items oi ON oi.id=t.order_item_id
        JOIN orders o ON o.id=oi.order_id
        WHERE (t.event_id=$1 OR oi.event_id=$1 OR t.ticket_type_id IN (SELECT id FROM ticket_types WHERE event_id=$1)) AND
          (t.event_id<>oi.event_id OR t.ticket_type_id<>oi.ticket_type_id OR t.user_id<>o.user_id)) AS cross_mismatch`, [eventId]);
    return { event: rows[0], counts, fingerprints, integrity };
  },
  async findRequest(requestId, client = getPool()) {
    const { rows } = await client.query('SELECT * FROM event_deletion_audit WHERE request_id=$1', [requestId]);
    return rows[0] ?? null;
  },
  async archive(client, eventId) {
    await client.query('UPDATE events SET is_active=FALSE, deleted_at=NOW(), updated_at=NOW() WHERE id=$1', [eventId]);
    await client.query('UPDATE ticket_types SET active=FALSE WHERE event_id=$1 AND active=TRUE', [eventId]);
    await client.query('DELETE FROM cart_items WHERE ticket_type_id IN (SELECT id FROM ticket_types WHERE event_id=$1)', [eventId]);
    await client.query('DELETE FROM yomogan_embeddings WHERE event_id=$1', [eventId]);
  },
  async remove(client, eventId) {
    // Existing FK CASCADE handles only disposable data; commerce FK RESTRICT remains.
    await client.query('DELETE FROM events WHERE id=$1', [eventId]);
  },
  async record(client, actor, requestId, impact) {
    await client.query(`INSERT INTO event_deletion_audit
      (request_id, actor_id, actor_role, event_id, operation, analysis_hash, impact)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [requestId, actor.id, actor.role, impact.eventId, impact.operation, impact.analysisToken, JSON.stringify(impact)]);
  },
};
