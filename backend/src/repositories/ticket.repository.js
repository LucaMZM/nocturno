import { getPool } from '../config/db.js';
import { toCamel } from '../utils/mapping.js';

const ticketSelect = `SELECT t.*, e.title AS event_title, e.slug AS event_slug,
  e.starts_at, e.ends_at, e.promoter_id, v.name AS venue_name,
  v.address AS venue_address, tt.name AS ticket_type_name,
  u.display_name, u.email, oi.order_id
  FROM tickets t JOIN events e ON e.id = t.event_id
  JOIN venues v ON v.id = e.venue_id
  JOIN ticket_types tt ON tt.id = t.ticket_type_id
  JOIN order_items oi ON oi.id = t.order_item_id
  JOIN users u ON u.id = t.user_id`;

export const ticketRepository = {
  async listAll({ page, limit, status, search }) {
    const params = [status ?? null, search ? `%${search}%` : null];
    const where = `WHERE ($1::text IS NULL OR t.status = $1)
      AND ($2::text IS NULL OR e.title ILIKE $2 OR t.code::text ILIKE $2)`;
    const { rows } = await getPool().query(
      `${ticketSelect} ${where} ORDER BY t.issued_at DESC, t.id LIMIT $3 OFFSET $4`,
      [...params, limit, (page - 1) * limit]);
    const total = Number((await getPool().query(
      `SELECT count(*) AS total FROM tickets t JOIN events e ON e.id = t.event_id ${where}`, params)).rows[0].total);
    return { rows: rows.map(toCamel), total };
  },
  async listForUser(userId, { page, limit }) {
    const { rows } = await getPool().query(
      `${ticketSelect} WHERE t.user_id = $1
       ORDER BY t.issued_at DESC, t.id LIMIT $2 OFFSET $3`,
      [userId, limit, (page - 1) * limit]);
    const total = Number((await getPool().query(
      'SELECT count(*) AS total FROM tickets WHERE user_id = $1', [userId])).rows[0].total);
    return { rows: rows.map(toCamel), total };
  },
  async getForUser(ticketId, userId) {
    const { rows } = await getPool().query(
      `${ticketSelect} WHERE t.id = $1 AND t.user_id = $2`, [ticketId, userId]);
    return toCamel(rows[0]) ?? null;
  },
  async getForCheckIn(client, code) {
    const { rows } = await client.query(
      `${ticketSelect} WHERE t.code = $1 FOR UPDATE OF t`, [code]);
    return toCamel(rows[0]) ?? null;
  },
  async markUsed(client, ticketId) {
    const { rows } = await client.query(
      "UPDATE tickets SET status = 'USED', used_at = NOW() WHERE id = $1 RETURNING *",
      [ticketId]);
    return toCamel(rows[0]);
  },
  async listAttendees(eventId, { page, limit, search }) {
    const term = search ? `%${search}%` : null;
    const where = `t.event_id = $1 AND ($2::text IS NULL OR t.code::text ILIKE $2
      OR u.display_name ILIKE $2 OR u.email ILIKE $2 OR oi.order_id::text ILIKE $2)`;
    const { rows } = await getPool().query(
      `SELECT t.id, t.code, t.status, t.issued_at, t.used_at,
              u.id AS user_id, u.display_name, u.email,
              tt.name AS ticket_type_name, oi.order_id
       FROM tickets t JOIN users u ON u.id = t.user_id
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
       JOIN order_items oi ON oi.id = t.order_item_id
       WHERE ${where} ORDER BY t.issued_at DESC, t.id
       LIMIT $3 OFFSET $4`, [eventId, term, limit, (page - 1) * limit]);
    const total = Number((await getPool().query(
      `SELECT count(*) AS total FROM tickets t JOIN users u ON u.id = t.user_id
       JOIN order_items oi ON oi.id = t.order_item_id WHERE ${where}`,
      [eventId, term])).rows[0].total);
    return { rows: rows.map(toCamel), total };
  },
  async getCheckInOverview(eventId) {
    const { rows } = await getPool().query(`
      SELECT e.id AS event_id, e.title AS event_title, e.starts_at, v.name AS venue_name,
        (SELECT coalesce(sum(quantity), 0)::integer FROM ticket_types WHERE event_id = e.id) AS capacity,
        (SELECT count(*)::integer FROM tickets WHERE event_id = e.id) AS issued,
        (SELECT count(*)::integer FROM tickets WHERE event_id = e.id AND status = 'USED') AS used,
        (SELECT count(*)::integer FROM tickets WHERE event_id = e.id AND status = 'VALID') AS pending,
        (SELECT count(*)::integer FROM tickets WHERE event_id = e.id AND status IN ('CANCELLED','REFUNDED')) AS rejected
      FROM events e JOIN venues v ON v.id = e.venue_id WHERE e.id = $1`, [eventId]);
    const recent = await getPool().query(`
      SELECT t.id, t.used_at, u.display_name, tt.name AS ticket_type_name
      FROM tickets t JOIN users u ON u.id = t.user_id
      JOIN ticket_types tt ON tt.id = t.ticket_type_id
      WHERE t.event_id = $1 AND t.status = 'USED'
      ORDER BY t.used_at DESC, t.id LIMIT 8`, [eventId]);
    return { ...toCamel(rows[0]), recent: recent.rows.map(toCamel) };
  }
};
