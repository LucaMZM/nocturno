import { getPool } from '../config/db.js';
export const eventViewsRepository = {
  async record(slug) {
    const result = await getPool().query(`INSERT INTO event_daily_views(event_id,day,views)
      SELECT id,(NOW() AT TIME ZONE 'Europe/Madrid')::date,1 FROM events
      WHERE slug=$1 AND is_active AND deleted_at IS NULL AND status IN ('PUBLISHED','SOLD_OUT')
      ON CONFLICT(event_id,day) DO UPDATE SET views=event_daily_views.views+1 RETURNING event_id`, [slug]);
    return result.rowCount > 0;
  },
  async ranking(actor, days) {
    const { rows } = await getPool().query(`SELECT e.id,e.title,e.slug,coalesce(sum(d.views),0)::int AS views,
      (SELECT coalesce(sum(t.sold),0)::int FROM ticket_types t WHERE t.event_id=e.id) AS sold
      FROM events e JOIN event_daily_views d ON d.event_id=e.id
      WHERE d.day >= (NOW() AT TIME ZONE 'Europe/Madrid')::date - ($1::int-1)
      AND ($2::uuid IS NULL OR e.promoter_id=$2)
      GROUP BY e.id ORDER BY views DESC,e.id LIMIT 10`, [days, actor.role === 'ADMIN' ? null : actor.promoterId]);
    return rows;
  },
};
