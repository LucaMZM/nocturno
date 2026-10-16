import { getPool } from '../config/db.js';
import { mapEvent } from '../models/event.model.js';
export const favoriteRepository = {
  async list(userId, { page, limit }) {
    const { rows } = await getPool().query(`SELECT e.*, f.created_at AS favorited_at,
      v.name AS venue_name, v.municipality, v.province,
      ticket_summary.min_price, ticket_summary.ticket_availability,
      count(*) OVER() AS total_count
      FROM favorites f JOIN events e ON e.id = f.event_id
      JOIN venues v ON v.id = e.venue_id
      LEFT JOIN LATERAL (
        SELECT min(price) AS min_price,
          coalesce(sum(quantity - sold - reserved), 0) AS ticket_availability
        FROM ticket_types tt WHERE tt.event_id = e.id AND tt.active
      ) ticket_summary ON true
      WHERE f.user_id = $1 AND e.is_active = TRUE AND e.deleted_at IS NULL AND e.status IN ('PUBLISHED', 'SOLD_OUT')
      ORDER BY f.created_at DESC, e.id LIMIT $2 OFFSET $3`, [userId, limit, (page - 1) * limit]);
    const total = rows.length ? Number(rows[0].total_count) : Number((await getPool().query(`SELECT count(*) AS total FROM favorites f JOIN events e ON e.id = f.event_id
      WHERE f.user_id = $1 AND e.is_active = TRUE AND e.deleted_at IS NULL AND e.status IN ('PUBLISHED', 'SOLD_OUT')`, [userId])).rows[0].total);
    return { rows: rows.map(({ total_count, ...row }) => mapEvent(row)), total };
  },
  async add(userId, eventId) {
    const { rows } = await getPool().query('INSERT INTO favorites (user_id, event_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *', [userId, eventId]);
    return rows[0] || null;
  },
  async remove(userId, eventId) {
    const { rowCount } = await getPool().query('DELETE FROM favorites WHERE user_id = $1 AND event_id = $2', [userId, eventId]);
    return rowCount > 0;
  }
};
