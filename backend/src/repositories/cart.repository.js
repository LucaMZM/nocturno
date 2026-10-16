import { getPool } from '../config/db.js';
import { toCamel } from '../utils/mapping.js';

export const cartRepository = {
  async ensureCart(userId, client = getPool()) {
    const { rows } = await client.query(
      `INSERT INTO carts (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING id`, [userId]);
    if (rows[0]) return rows[0].id;
    const existing = await client.query('SELECT id FROM carts WHERE user_id = $1', [userId]);
    return existing.rows[0].id;
  },
  async lockCart(client, cartId) {
    await client.query('SELECT id FROM carts WHERE id = $1 FOR UPDATE', [cartId]);
  },
  async listItems(cartId, client = getPool()) {
    const { rows } = await client.query(
      `SELECT ci.id, ci.ticket_type_id, ci.quantity, ci.created_at, ci.updated_at,
              tt.name, (tt.price * 100)::bigint AS unit_price_cents,
              tt.quantity - tt.sold - tt.reserved AS available,
              tt.max_per_user, tt.active, tt.sales_start, tt.sales_end,
              e.id AS event_id, e.title AS event_title, e.slug AS event_slug,
              e.starts_at, e.status AS event_status, e.is_active AS event_active,
              e.deleted_at AS event_deleted_at, v.name AS venue_name
       FROM cart_items ci
       JOIN ticket_types tt ON tt.id = ci.ticket_type_id
       JOIN events e ON e.id = tt.event_id
       JOIN venues v ON v.id = e.venue_id
       WHERE ci.cart_id = $1 ORDER BY ci.created_at, ci.id`, [cartId]);
    return rows.map((row) => ({ ...toCamel(row), unitPriceCents: Number(row.unit_price_cents) }));
  },
  async getTicketForCart(client, ticketTypeId) {
    const { rows } = await client.query(
      `SELECT tt.*, e.status AS event_status, e.is_active AS event_active,
              e.deleted_at AS event_deleted_at
       FROM ticket_types tt JOIN events e ON e.id = tt.event_id
       WHERE tt.id = $1 FOR UPDATE OF tt`, [ticketTypeId]);
    return rows[0] ?? null;
  },
  async getItem(client, cartId, itemId) {
    const { rows } = await client.query(
      'SELECT * FROM cart_items WHERE id = $1 AND cart_id = $2', [itemId, cartId]);
    return rows[0] ?? null;
  },
  async getItemByTicketType(client, cartId, ticketTypeId) {
    const { rows } = await client.query(
      'SELECT * FROM cart_items WHERE cart_id = $1 AND ticket_type_id = $2',
      [cartId, ticketTypeId]);
    return rows[0] ?? null;
  },
  async setQuantity(client, cartId, ticketTypeId, quantity) {
    await client.query(
      `INSERT INTO cart_items (cart_id, ticket_type_id, quantity) VALUES ($1, $2, $3)
       ON CONFLICT (cart_id, ticket_type_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
      [cartId, ticketTypeId, quantity]);
  },
  async removeItem(cartId, itemId) {
    const { rowCount } = await getPool().query(
      'DELETE FROM cart_items WHERE cart_id = $1 AND id = $2', [cartId, itemId]);
    return rowCount > 0;
  },
  async clear(cartId) {
    await getPool().query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
  }
};
