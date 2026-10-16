import { crudRepository } from './crud.repository.js';
import { mapTicketType } from '../models/ticket-type.model.js';
import { getPool } from '../config/db.js';
export const ticketTypeRepository = {
  ...crudRepository('ticket_types', ['eventId', 'name', 'price', 'quantity', 'sold', 'salesStart', 'salesEnd', 'maxPerUser', 'benefits', 'active'], mapTicketType),
  async listByEvent(eventId, { page, limit }) {
    const { rows } = await getPool().query('SELECT *, count(*) OVER() AS total_count FROM ticket_types WHERE event_id = $1 ORDER BY price, id LIMIT $2 OFFSET $3', [eventId, limit, (page - 1) * limit]);
    const total = rows.length ? Number(rows[0].total_count) : Number((await getPool().query('SELECT count(*) AS total FROM ticket_types WHERE event_id = $1', [eventId])).rows[0].total);
    return { rows: rows.map(({ total_count, ...row }) => mapTicketType(row)), total };
  }
};
