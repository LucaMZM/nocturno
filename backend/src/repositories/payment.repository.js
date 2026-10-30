import { getPool } from '../config/db.js';

export const paymentRepository = {
  async findById(id) {
    const { rows } = await getPool().query(
      `SELECT p.*, o.status AS order_status FROM payments p
       JOIN orders o ON o.id = p.order_id WHERE p.id = $1`, [id]);
    return rows[0] ?? null;
  },
  async markRefundRequested(id, providerRefundId) {
    const { rows } = await getPool().query(`
      UPDATE payments SET refund_requested_at = coalesce(refund_requested_at, NOW()),
        provider_refund_id = coalesce(provider_refund_id, $2)
      WHERE id = $1 AND status IN ('PAID', 'REFUNDED')
      RETURNING refund_requested_at, provider_refund_id`, [id, providerRefundId]);
    return rows[0] ?? null;
  },
  async findPaymentByProviderId(client, paymentIntentId) {
    const { rows } = await client.query(
      'SELECT id, order_id FROM payments WHERE provider_payment_id = $1', [paymentIntentId]);
    return rows[0] ?? null;
  },
  async lockPaymentByProviderId(client, paymentIntentId) {
    const { rows } = await client.query(
      'SELECT * FROM payments WHERE provider_payment_id = $1 FOR UPDATE', [paymentIntentId]);
    return rows[0] ?? null;
  },
  async lockOrder(client, orderId) {
    const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    return rows[0] ?? null;
  },
  async getOrderItems(client, orderId) {
    const { rows } = await client.query(
      'SELECT * FROM order_items WHERE order_id = $1 ORDER BY ticket_type_id', [orderId]);
    return rows;
  },
  async lockTicketStock(client, ids) {
    const { rows } = await client.query(
      'SELECT id, reserved FROM ticket_types WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE',
      [ids]);
    return rows;
  },
  async fulfillOrder(client, order, items, paymentId = null) {
    for (const item of items) {
      await client.query(
        `UPDATE ticket_types SET reserved = reserved - $2, sold = sold + $2
         WHERE id = $1`, [item.ticket_type_id, item.quantity]);
      await client.query(
        `INSERT INTO tickets (order_item_id, user_id, event_id, ticket_type_id)
         SELECT $1, $2, $3, $4 FROM generate_series(1, $5)`,
        [item.id, order.user_id, item.event_id, item.ticket_type_id, item.quantity]);
    }
    if (paymentId)
      await client.query("UPDATE payments SET status = 'PAID' WHERE id = $1", [paymentId]);
    await client.query("UPDATE orders SET status = 'PAID' WHERE id = $1", [order.id]);
    await client.query(
      `DELETE FROM cart_items ci USING carts c, order_items oi
       WHERE ci.cart_id = c.id AND c.user_id = $1 AND oi.order_id = $2
         AND ci.ticket_type_id = oi.ticket_type_id AND ci.quantity = oi.quantity`,
      [order.user_id, order.id]);
  },
  async expireOrder(client, order, items) {
    for (const item of items)
      await client.query('UPDATE ticket_types SET reserved = reserved - $2 WHERE id = $1',
        [item.ticket_type_id, item.quantity]);
    await client.query("UPDATE orders SET status = 'EXPIRED' WHERE id = $1", [order.id]);
    await client.query("UPDATE payments SET status = 'FAILED' WHERE order_id = $1 AND status = 'PENDING'", [order.id]);
  },
  async listPayments({ page, limit, status, search, dateFrom, dateTo }) {
    const params = [status ?? null, search ? `%${search}%` : null, dateFrom ?? null, dateTo ?? null];
    const where = `WHERE ($1::text IS NULL OR p.status = $1)
      AND ($2::text IS NULL OR p.id::text ILIKE $2 OR p.order_id::text ILIKE $2
        OR p.provider_payment_id ILIKE $2 OR u.display_name ILIKE $2 OR u.email ILIKE $2)
      AND ($3::timestamptz IS NULL OR p.created_at >= $3)
      AND ($4::timestamptz IS NULL OR p.created_at <= $4)`;
    const from = `FROM payments p JOIN orders o ON o.id = p.order_id
      JOIN users u ON u.id = o.user_id`;
    const { rows } = await getPool().query(
      `SELECT p.*, o.status AS order_status, u.display_name AS buyer_name,
        count(*) OVER() AS total_count ${from} ${where}
       ORDER BY p.created_at DESC, p.id LIMIT $5 OFFSET $6`,
      [...params, limit, (page - 1) * limit]);
    const total = rows.length ? Number(rows[0].total_count)
      : Number((await getPool().query(`SELECT count(*) AS total ${from} ${where}`, params)).rows[0].total);
    return { rows: rows.map(({ total_count: _count, ...row }) => ({
      id: row.id, orderId: row.order_id, provider: row.provider,
      providerPaymentId: row.provider_payment_id, status: row.status,
      amountCents: Number(row.amount_cents), currency: row.currency,
      refundRequestedAt: row.refund_requested_at, providerRefundId: row.provider_refund_id,
      buyerName: row.buyer_name, orderStatus: row.order_status,
      createdAt: row.created_at, updatedAt: row.updated_at
    })), total };
  }
};
