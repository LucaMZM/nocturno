import { getPool } from '../config/db.js';
import { eventRepository } from './event.repository.js';
import { mapTicketType } from '../models/ticket-type.model.js';

// La misma visibilidad que Events; las facetas no exponen contactos privados.
const visible = "e.is_active = TRUE AND e.deleted_at IS NULL AND e.status IN ('PUBLISHED','SOLD_OUT')";
export const shopRepository = {
  findEvents: (filters) => eventRepository.findAll(filters),
  async categories() {
    const { rows } = await getPool().query(`SELECT DISTINCT unnest(e.music_genres) AS id
      FROM events e WHERE ${visible} ORDER BY id`);
    return rows.map(({ id }) => ({ id, name: id.replaceAll('_', ' ') }));
  },
  async hosts() {
    const { rows } = await getPool().query(`SELECT p.id,p.slug,p.name,p.description
      FROM promoters p WHERE EXISTS (SELECT 1 FROM events e
      WHERE e.promoter_id=p.id AND ${visible}) ORDER BY p.name,p.id`);
    return rows;
  },
  async locations() {
    const { rows } = await getPool().query(`SELECT v.id,v.slug,v.name,v.municipality,v.province,
      v.image_url AS "imageUrl" FROM venues v WHERE EXISTS (SELECT 1 FROM events e
      WHERE e.venue_id=v.id AND ${visible}) ORDER BY v.name,v.id`);
    return rows;
  },
  async variants(eventId) {
    const { rows } = await getPool().query(`SELECT *, greatest(0, quantity-sold-reserved) AS available
      FROM ticket_types WHERE event_id=$1 AND active=TRUE ORDER BY price,id`, [eventId]);
    return rows.map(mapTicketType);
  },
};
