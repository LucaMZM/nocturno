import { getPool } from '../config/db.js';
import { toCamel } from '../utils/mapping.js';

function mapOrder(row) {
  if (!row) return null;
  const order = toCamel(row);
  return {
    ...order,
    subtotalCents: Number(row.subtotal_cents),
    totalCents: Number(row.total_cents)
  };
}

export const orderRepository = {
  async findByIdempotencyKey(client, userId, key) {
    const { rows } = await client.query(
      'SELECT * FROM orders WHERE user_id = $1 AND idempotency_key = $2', [userId, key]);
    return mapOrder(rows[0]);
  },
  async lockCart(client, userId) {
    const { rows } = await client.query(
      'SELECT id FROM carts WHERE user_id = $1 FOR UPDATE', [userId]);
    return rows[0]?.id ?? null;
  },
  async lockCartTickets(client, cartId) {
    // Serialize new reservations with archival; re-read availability after taking the lock.
    await client.query(`SELECT e.id FROM events e JOIN ticket_types tt ON tt.event_id=e.id
      JOIN cart_items ci ON ci.ticket_type_id=tt.id WHERE ci.cart_id=$1
      ORDER BY e.id FOR SHARE OF e`, [cartId]);
    const { rows } = await client.query(
      `SELECT ci.quantity AS requested, tt.id AS ticket_type_id, tt.event_id,
              tt.name, tt.price, tt.quantity AS stock, tt.sold, tt.reserved,
              tt.max_per_user, tt.active, tt.sales_start, tt.sales_end,
              e.title AS event_title, e.starts_at AS event_starts_at,
              e.ends_at AS event_ends_at,
              v.name AS venue_name, e.status AS event_status, e.is_active AS event_active,
              e.deleted_at AS event_deleted_at
       FROM cart_items ci JOIN ticket_types tt ON tt.id = ci.ticket_type_id
       JOIN events e ON e.id = tt.event_id JOIN venues v ON v.id = e.venue_id
       WHERE ci.cart_id = $1 ORDER BY tt.id FOR UPDATE OF tt`, [cartId]);
    return rows;
  },
  async countCommittedTickets(client, userId, ticketTypeIds) {
    const { rows } = await client.query(
      `SELECT oi.ticket_type_id, sum(oi.quantity)::integer AS quantity
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.user_id = $1 AND o.status IN ('AWAITING_PAYMENT','PAID')
         AND oi.ticket_type_id = ANY($2::uuid[])
       GROUP BY oi.ticket_type_id`, [userId, ticketTypeIds]);
    return new Map(rows.map((row) => [row.ticket_type_id, row.quantity]));
  },
  async createOrder(client, { userId, key, totalCents, expiresAt }) {
    const { rows } = await client.query(
      `INSERT INTO orders (user_id, idempotency_key, subtotal_cents, total_cents, expires_at)
       VALUES ($1, $2, $3, $3, $4) RETURNING *`, [userId, key, totalCents, expiresAt]);
    return mapOrder(rows[0]);
  },
  async addOrderItem(client, orderId, item, unitPriceCents) {
    await client.query(
      `INSERT INTO order_items (order_id, event_id, ticket_type_id, name,
                                unit_price_cents, quantity, subtotal_cents,
                                event_title_snapshot, venue_name_snapshot, starts_at_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [orderId, item.event_id, item.ticket_type_id, item.name,
        unitPriceCents, item.requested, unitPriceCents * item.requested,
        item.event_title, item.venue_name, item.event_starts_at]);
  },
  async reserveStock(client, ticketTypeId, quantity) {
    await client.query('UPDATE ticket_types SET reserved = reserved + $2 WHERE id = $1',
      [ticketTypeId, quantity]);
  },
  async createPendingPayment(client, orderId, amountCents) {
    await client.query(
      `INSERT INTO payments (order_id, provider, status, amount_cents)
       VALUES ($1, 'STRIPE', 'PENDING', $2)`, [orderId, amountCents]);
  },
  async getOrder(orderId, userId = null, client = getPool()) {
    const { rows } = await client.query(
      `SELECT o.*, p.id AS payment_id, p.status AS payment_status, p.provider_payment_id,
         p.refund_requested_at, u.display_name AS buyer_name, u.email AS buyer_email
       FROM orders o JOIN users u ON u.id = o.user_id
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE o.id = $1 AND ($2::uuid IS NULL OR o.user_id = $2)`, [orderId, userId]);
    const order = mapOrder(rows[0]);
    if (!order) return null;
    const items = await client.query(
      `SELECT oi.*, oi.event_title_snapshot AS event_title, e.slug AS event_slug,
              oi.starts_at_snapshot AS starts_at, oi.venue_name_snapshot AS venue_name
       FROM order_items oi JOIN events e ON e.id = oi.event_id
       WHERE oi.order_id = $1 ORDER BY oi.id`, [orderId]);
    order.items = items.rows.map((row) => ({
      ...toCamel(row),
      unitPriceCents: Number(row.unit_price_cents),
      subtotalCents: Number(row.subtotal_cents)
    }));
    const tickets = await client.query(`
      SELECT t.id, t.code, t.status, t.issued_at, t.used_at, t.order_item_id
      FROM tickets t JOIN order_items oi ON oi.id = t.order_item_id
      WHERE oi.order_id = $1 ORDER BY t.issued_at, t.id`, [orderId]);
    order.tickets = tickets.rows.map(toCamel);
    return order;
  },
  async listOrders(userId, { page, limit, status, search, eventId, dateFrom, dateTo }) {
    const params = [userId, status ?? null, search ? `%${search}%` : null,
      eventId ?? null, dateFrom ?? null, dateTo ?? null];
    const where = `WHERE ($1::uuid IS NULL OR o.user_id = $1)
      AND ($2::text IS NULL OR o.status = $2)
      AND ($3::text IS NULL OR o.id::text ILIKE $3 OR u.display_name ILIKE $3
        OR u.email ILIKE $3 OR EXISTS (SELECT 1 FROM order_items oi
          WHERE oi.order_id = o.id AND oi.event_title_snapshot ILIKE $3))
      AND ($4::uuid IS NULL OR EXISTS (SELECT 1 FROM order_items oi
        WHERE oi.order_id = o.id AND oi.event_id = $4))
      AND ($5::timestamptz IS NULL OR o.created_at >= $5)
      AND ($6::timestamptz IS NULL OR o.created_at <= $6)`;
    const from = `FROM orders o JOIN users u ON u.id = o.user_id
      LEFT JOIN payments p ON p.order_id = o.id`;
    const { rows } = await getPool().query(
      `SELECT o.*, u.display_name AS buyer_name, u.email AS buyer_email,
        p.status AS payment_status, p.provider_payment_id,
        items.event_titles, items.item_count, count(*) OVER() AS total_count
       ${from} LEFT JOIN LATERAL (
         SELECT string_agg(DISTINCT oi.event_title_snapshot, ' · ') AS event_titles,
           coalesce(sum(oi.quantity), 0)::integer AS item_count
         FROM order_items oi WHERE oi.order_id = o.id
       ) items ON true ${where}
       ORDER BY o.created_at DESC, o.id LIMIT $7 OFFSET $8`,
      [...params, limit, (page - 1) * limit]);
    const total = rows.length ? Number(rows[0].total_count)
      : Number((await getPool().query(`SELECT count(*) AS total ${from} ${where}`, params)).rows[0].total);
    return { rows: rows.map(({ total_count: _count, ...row }) => mapOrder(row)), total };
  },
  async setProviderPaymentId(orderId, paymentIntentId, client = getPool()) {
    const { rows } = await client.query(
      `UPDATE payments SET provider_payment_id = $2 WHERE order_id = $1
       RETURNING provider_payment_id`, [orderId, paymentIntentId]);
    return rows[0] ?? null;
  },
  async findExpiredOrderIds(limit = 20) {
    const { rows } = await getPool().query(
      `SELECT id FROM orders WHERE status = 'AWAITING_PAYMENT' AND expires_at < NOW()
       ORDER BY expires_at LIMIT $1`, [limit]);
    return rows.map((row) => row.id);
  }
};
