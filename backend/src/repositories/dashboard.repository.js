import { getPool } from '../config/db.js';
import { mapEvent } from '../models/event.model.js';
import { toCamel } from '../utils/mapping.js';

function scope(actor, values, column = 'e.promoter_id') {
  if (actor.role === 'ADMIN') return 'TRUE';
  values.push(actor.promoterId);
  return `${column} = $${values.length}`;
}

export const dashboardRepository = {
  async getSummary(actor) {
    const values = [];
    const eventScope = scope(actor, values);
    const { rows } = await getPool().query(
      `SELECT
        (SELECT count(*) FROM events e WHERE ${eventScope} AND e.deleted_at IS NULL)::integer AS events,
        (SELECT count(*) FROM events e WHERE ${eventScope} AND e.deleted_at IS NULL
          AND e.is_active AND e.starts_at > NOW())::integer AS upcoming_events,
        (SELECT count(*) FROM events e WHERE ${eventScope} AND e.deleted_at IS NULL
          AND e.is_active)::integer AS active_events,
        (SELECT count(*) FROM events e WHERE ${eventScope} AND e.deleted_at IS NULL
          AND e.status = 'SOLD_OUT')::integer AS sold_out_events,
        (SELECT coalesce(sum(tt.sold), 0) FROM ticket_types tt JOIN events e ON e.id = tt.event_id
          WHERE ${eventScope})::integer AS tickets_sold,
        (SELECT CASE WHEN coalesce(sum(tt.quantity), 0) = 0 THEN 0
          ELSE round(100.0 * sum(tt.sold) / sum(tt.quantity), 1) END
          FROM ticket_types tt JOIN events e ON e.id = tt.event_id
          WHERE ${eventScope} AND e.status IN ('PUBLISHED','SOLD_OUT') AND e.is_active)::numeric AS occupancy_percent,
        (SELECT coalesce(sum(oi.subtotal_cents), 0) FROM order_items oi
          JOIN orders o ON o.id = oi.order_id JOIN events e ON e.id = oi.event_id
          WHERE o.status = 'PAID' AND ${eventScope})::bigint AS revenue_cents,
        (SELECT coalesce(sum(oi.subtotal_cents), 0) FROM order_items oi
          JOIN orders o ON o.id = oi.order_id JOIN events e ON e.id = oi.event_id
          WHERE o.status = 'PAID' AND o.created_at >= NOW() - INTERVAL '30 days'
            AND ${eventScope})::bigint AS revenue_period_cents,
        (SELECT count(*) FROM tickets t JOIN events e ON e.id = t.event_id
          WHERE t.status = 'USED' AND ${eventScope})::integer AS attendees,
        (SELECT coalesce(round(sum(oi.subtotal_cents)::numeric /
          nullif(sum(oi.quantity), 0)), 0) FROM order_items oi
          JOIN orders o ON o.id = oi.order_id JOIN events e ON e.id = oi.event_id
          WHERE o.status = 'PAID' AND ${eventScope})::bigint AS average_ticket_cents,
        (SELECT count(*) FROM order_items oi JOIN orders o ON o.id = oi.order_id
          JOIN events e ON e.id = oi.event_id WHERE o.status = 'PAID'
            AND o.created_at >= NOW() - INTERVAL '24 hours' AND ${eventScope})::integer AS sales_24h,
        (SELECT count(*) FROM order_items oi JOIN orders o ON o.id = oi.order_id
          JOIN events e ON e.id = oi.event_id WHERE o.status = 'PAID'
            AND o.created_at >= NOW() - INTERVAL '7 days' AND ${eventScope})::integer AS sales_7d,
        (SELECT count(*) FROM order_items oi JOIN orders o ON o.id = oi.order_id
          JOIN events e ON e.id = oi.event_id WHERE o.status = 'PAID'
            AND o.created_at >= NOW() - INTERVAL '30 days' AND ${eventScope})::integer AS sales_30d,
        (SELECT count(*) FROM orders o ${actor.role === 'ADMIN' ? 'WHERE TRUE' :
          'WHERE EXISTS (SELECT 1 FROM order_items oi JOIN events e ON e.id = oi.event_id WHERE oi.order_id = o.id AND e.promoter_id = $1)'})::integer AS orders,
        ${actor.role === 'ADMIN' ? '(SELECT count(*) FROM users)::integer' : 'NULL::integer'} AS users,
        ${actor.role === 'ADMIN' ? '(SELECT count(*) FROM promoters)::integer' : 'NULL::integer'} AS promoters`, values);
    const summary = toCamel(rows[0]);
    summary.revenueCents = Number(rows[0].revenue_cents);
    summary.revenuePeriodCents = Number(rows[0].revenue_period_cents);
    summary.averageTicketCents = Number(rows[0].average_ticket_cents);
    summary.occupancyPercent = Number(rows[0].occupancy_percent);
    const alerts = await getPool().query(
      `SELECT tt.id, tt.name, e.title AS event_title,
              (tt.quantity - tt.sold - tt.reserved) AS available
       FROM ticket_types tt JOIN events e ON e.id = tt.event_id
       WHERE ${eventScope} AND e.deleted_at IS NULL AND tt.active
         AND (tt.quantity - tt.sold - tt.reserved) <= 10
       ORDER BY available, tt.id LIMIT 5`, values);
    const recentSales = await dashboardRepository.listSales(actor, { page: 1, limit: 5 });
    const topEvents = await dashboardRepository.listTopEvents(actor, 'revenue');
    const salesTrend = await dashboardRepository.getSalesTrend(actor);
    return { ...summary, lowStock: alerts.rows.map(toCamel), recentSales: recentSales.rows,
      topEvents, salesTrend };
  },
  async listTopEvents(actor, sort = 'revenue') {
    const values = [];
    const eventScope = scope(actor, values);
    const order = { revenue: 'revenue_cents DESC', tickets: 'tickets_sold DESC',
      date: 'e.starts_at ASC' }[sort];
    const { rows } = await getPool().query(`
      WITH sales AS (
        SELECT oi.event_id, sum(oi.quantity)::integer AS tickets_sold,
          sum(oi.subtotal_cents)::bigint AS revenue_cents
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.status = 'PAID' GROUP BY oi.event_id
      ), stock AS (
        SELECT event_id, sum(quantity)::integer AS capacity FROM ticket_types GROUP BY event_id
      )
      SELECT e.id, e.title, e.status, e.starts_at, v.name AS venue_name,
        coalesce(s.tickets_sold, 0) AS tickets_sold,
        coalesce(s.revenue_cents, 0) AS revenue_cents,
        coalesce(st.capacity, 0) AS capacity
      FROM events e JOIN venues v ON v.id = e.venue_id
      LEFT JOIN sales s ON s.event_id = e.id LEFT JOIN stock st ON st.event_id = e.id
      WHERE ${eventScope} AND e.deleted_at IS NULL
      ORDER BY ${order}, e.id LIMIT 8`, values);
    return rows.map((row) => ({ ...toCamel(row), revenueCents: Number(row.revenue_cents) }));
  },
  async getSalesTrend(actor) {
    const values = [];
    const eventScope = scope(actor, values);
    const { rows } = await getPool().query(`
      WITH days AS (SELECT generate_series(current_date - 29, current_date, '1 day'::interval)::date AS day),
      sales AS (
        SELECT (o.created_at AT TIME ZONE 'Europe/Madrid')::date AS day,
          sum(oi.subtotal_cents)::bigint AS revenue_cents,
          sum(oi.quantity)::integer AS tickets
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        JOIN events e ON e.id = oi.event_id
        WHERE o.status = 'PAID' AND o.created_at >= NOW() - INTERVAL '30 days'
          AND ${eventScope}
        GROUP BY 1
      )
      SELECT d.day, coalesce(s.revenue_cents, 0) AS revenue_cents,
        coalesce(s.tickets, 0) AS tickets
      FROM days d LEFT JOIN sales s ON s.day = d.day ORDER BY d.day`, values);
    return rows.map((row) => ({ day: row.day, revenueCents: Number(row.revenue_cents),
      tickets: row.tickets }));
  },
  async listEvents(actor, { page, limit, search, status, deleted = 'exclude', active = 'all',
    promoterId, venueId, municipality, dateFrom, dateTo }) {
    const values = [];
    const where = [scope(actor, values), deleted === 'only' ? 'e.deleted_at IS NOT NULL' : 'e.deleted_at IS NULL'];
    if (deleted !== 'only' && active !== 'all') {
      values.push(active === 'true'); where.push(`e.is_active = $${values.length}`);
    }
    if (search) { values.push(`%${search}%`); where.push(`e.title ILIKE $${values.length}`); }
    if (status) { values.push(status); where.push(`e.status = $${values.length}`); }
    if (promoterId) { values.push(promoterId); where.push(`e.promoter_id = $${values.length}`); }
    if (venueId) { values.push(venueId); where.push(`e.venue_id = $${values.length}`); }
    if (municipality) { values.push(municipality); where.push(`v.municipality ILIKE $${values.length}`); }
    if (dateFrom) { values.push(dateFrom); where.push(`e.starts_at >= $${values.length}`); }
    if (dateTo) { values.push(dateTo); where.push(`e.starts_at <= $${values.length}`); }
    const clause = where.join(' AND ');
    const count = await getPool().query(
      `SELECT count(*) AS total FROM events e JOIN venues v ON v.id = e.venue_id WHERE ${clause}`, values);
    values.push(limit, (page - 1) * limit);
    const { rows } = await getPool().query(
      `SELECT e.*, v.name AS venue_name, v.municipality, v.province
       FROM events e JOIN venues v ON v.id = e.venue_id WHERE ${clause}
       ORDER BY e.created_at DESC, e.id LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values);
    return { rows: rows.map(mapEvent), total: Number(count.rows[0].total) };
  },
  async listSales(actor, { page, limit, eventId, search }) {
    const values = [];
    const where = scope(actor, values);
    const eventFilter = eventId ? ` AND oi.event_id = $${values.push(eventId)}` : '';
    const searchFilter = search ? ` AND (e.title ILIKE $${values.push(`%${search}%`)} OR u.display_name ILIKE $${values.length})` : '';
    const count = await getPool().query(
      `SELECT count(*) AS total FROM order_items oi JOIN events e ON e.id = oi.event_id
       JOIN orders o ON o.id = oi.order_id JOIN users u ON u.id = o.user_id
       WHERE ${where} AND o.status = 'PAID'${eventFilter}${searchFilter}`, values);
    values.push(limit, (page - 1) * limit);
    const { rows } = await getPool().query(
      `SELECT oi.id, oi.order_id, oi.event_id, e.title AS event_title,
              oi.name AS ticket_type_name, oi.quantity, oi.subtotal_cents,
              o.created_at, u.display_name AS buyer_name, p.status AS payment_status
       FROM order_items oi JOIN events e ON e.id = oi.event_id
       JOIN orders o ON o.id = oi.order_id JOIN users u ON u.id = o.user_id
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE ${where} AND o.status = 'PAID'${eventFilter}${searchFilter}
       ORDER BY o.created_at DESC, oi.id LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values);
    return { rows: rows.map((row) => ({ ...toCamel(row), subtotalCents: Number(row.subtotal_cents) })),
      total: Number(count.rows[0].total) };
  }
};
