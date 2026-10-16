import { getPool } from '../config/db.js';
import { toCamel } from '../utils/mapping.js';

export const waitlistRepository = {
  async availability(eventId) {
    const { rows } = await getPool().query(`
      SELECT e.id, e.status, e.is_active, e.deleted_at, e.ends_at,
        count(tt.id) FILTER (WHERE tt.active)::integer AS ticket_types,
        coalesce(sum(CASE WHEN tt.active THEN greatest(0, tt.quantity - tt.sold - tt.reserved)
          ELSE 0 END), 0)::integer AS available
      FROM events e LEFT JOIN ticket_types tt ON tt.event_id = e.id
      WHERE e.id = $1 GROUP BY e.id`, [eventId]);
    return toCamel(rows[0]) ?? null;
  },
  async find(eventId, userId) {
    const { rows } = await getPool().query(
      'SELECT id, event_id, created_at FROM event_waitlist WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]);
    return toCamel(rows[0]) ?? null;
  },
  async join(eventId, user) {
    const { rows } = await getPool().query(`
      INSERT INTO event_waitlist (event_id, user_id, email) VALUES ($1, $2, $3)
      ON CONFLICT (event_id, user_id) DO UPDATE SET email = EXCLUDED.email
      RETURNING id, event_id, created_at`, [eventId, user.id, user.email.toLowerCase()]);
    return toCamel(rows[0]);
  }
};
