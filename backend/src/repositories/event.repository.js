import { getPool } from '../config/db.js';
import { mapEvent } from '../models/event.model.js';

const eventFields = [
  'venueId',
  'promoterId',
  'title',
  'slug',
  'description',
  'eventType',
  'startsAt',
  'endsAt',
  'minimumAge',
  'dressCode',
  'musicGenres',
  'atmosphere',
  'idealFor',
  'posterUrl',
  'sourceUrl',
  'imageSourceUrl',
  'status',
  'isActive',
];
const priceSql = `LEFT JOIN LATERAL (
  SELECT min(price) AS min_price, coalesce(sum(quantity - sold - reserved), 0) AS ticket_availability
  FROM ticket_types t WHERE t.event_id = e.id AND t.active = true
) tickets ON true`;
const gallerySql = `LEFT JOIN LATERAL (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', image.id, 'url', image.url, 'position', image.position,
    'altText', image.alt_text, 'sourceUrl', image.source_url
  ) ORDER BY image.position), '[]'::jsonb) AS images
  FROM event_images image WHERE image.event_id = e.id
) gallery ON true`;

const columnName = (field) => field.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);

async function replaceImages(client, eventId, images) {
  await client.query('DELETE FROM event_images WHERE event_id = $1', [eventId]);
  for (const [position, image] of images.entries()) {
    await client.query(
      `INSERT INTO event_images (event_id, url, position, alt_text, source_url, origin)
       VALUES ($1,$2,$3,$4,$5,'USER')`,
      [eventId, image.url, position, image.altText ?? null, image.sourceUrl ?? null],
    );
  }
}

export function buildEventListQuery(filters) {
  const values = [];
  const hasCoordinates = filters.latitude !== undefined && filters.longitude !== undefined;
  const geoJoin = hasCoordinates ? `LEFT JOIN LATERAL (
    SELECT CASE WHEN v.latitude IS NULL OR v.longitude IS NULL THEN NULL
      ELSE 6371.0088 * 2 * asin(sqrt(least(1, greatest(0,
        power(sin(radians((v.latitude::double precision - $1) / 2)), 2) +
        cos(radians($1)) * cos(radians(v.latitude::double precision)) *
        power(sin(radians((v.longitude::double precision - $2) / 2)), 2)
      )))) END AS distance_km
  ) geo ON TRUE` : '';
  if (hasCoordinates) values.push(filters.latitude, filters.longitude);
  // Apply public visibility in SQL so filtering, counts and pagination agree.
  const where = ['e.is_active = TRUE', 'e.deleted_at IS NULL', "e.status IN ('PUBLISHED','SOLD_OUT')"];
  const addFilter = (sql, value) => {
    values.push(value);
    where.push(sql.replaceAll('?', `$${values.length}`));
  };
  if (filters.municipality)
    addFilter('v.municipality ILIKE ?', filters.municipality);
  if (filters.province) addFilter('v.province ILIKE ?', filters.province);
  if (filters.genre) addFilter('? = ANY(e.music_genres)', filters.genre);
  if (filters.atmosphere) addFilter('? = ANY(e.atmosphere)', filters.atmosphere);
  if (filters.eventType) addFilter('e.event_type = ?', filters.eventType);
  if (filters.venueId) addFilter('e.venue_id = ?', filters.venueId);
  if (filters.promoterId) addFilter('e.promoter_id = ?', filters.promoterId);
  if (filters.idealFor) addFilter('? = ANY(e.ideal_for)', filters.idealFor);
  if (filters.dressCode) addFilter('e.dress_code = ?', filters.dressCode);
  if (filters.status) addFilter('e.status = ?', filters.status);
  if (filters.dateFrom) addFilter('e.starts_at >= ?', filters.dateFrom);
  if (filters.dateTo) addFilter('e.starts_at <= ?', filters.dateTo);
  if (filters.minPrice !== undefined)
    addFilter('tickets.min_price >= ?', filters.minPrice);
  if (filters.maxPrice !== undefined)
    addFilter('tickets.min_price <= ?', filters.maxPrice);
  if (filters.minimumAge !== undefined)
    addFilter(
      'coalesce(e.minimum_age, v.minimum_age, 0) <= ?',
      filters.minimumAge,
    );
  if (filters.search)
    addFilter(
      '(e.title ILIKE ? OR e.description ILIKE ? OR v.name ILIKE ?)',
      `%${filters.search}%`,
    );
  if (filters.radiusKm !== undefined) addFilter('geo.distance_km <= ?', filters.radiusKm);

  const order = {
    date: 'e.starts_at ASC',
    price: 'tickets.min_price ASC NULLS LAST, e.starts_at ASC',
    createdAt: 'e.created_at DESC',
    distance: 'geo.distance_km ASC NULLS LAST, e.starts_at ASC',
  }[filters.sort ?? 'date'];
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const filterValues = [...values];
  values.push(filters.limit, (filters.page - 1) * filters.limit);
  return {
    sql: `SELECT e.*, v.name AS venue_name, v.slug AS venue_slug, v.municipality, v.province, v.latitude AS venue_latitude, v.longitude AS venue_longitude,
      tickets.min_price, tickets.ticket_availability, gallery.images, ${hasCoordinates ? 'geo.distance_km' : 'NULL::double precision'} AS distance_km,
      count(*) OVER() AS total_count FROM events e JOIN venues v ON v.id = e.venue_id ${priceSql} ${gallerySql} ${geoJoin} ${clause}
      ORDER BY ${order}, e.id LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
    countSql: `SELECT count(*) AS total FROM events e JOIN venues v ON v.id = e.venue_id ${priceSql} ${geoJoin} ${clause}`,
    filterValues,
  };
}

export const eventRepository = {
  async findAll(eventFilters) {
    const { sql, values, countSql, filterValues } =
      buildEventListQuery(eventFilters);
    const { rows } = await getPool().query(sql, values);
    const total = rows.length
      ? Number(rows[0].total_count)
      : Number((await getPool().query(countSql, filterValues)).rows[0].total);
    const events = rows.map(({ total_count, ...row }) => mapEvent(row));
    return { events, total };
  },

  async findPublicBySlug(eventSlug) {
    const { rows } = await getPool().query(
      `SELECT e.*, v.name AS venue_name, v.slug AS venue_slug, v.municipality, v.province, v.latitude AS venue_latitude, v.longitude AS venue_longitude,
      p.name AS promoter_name, p.slug AS promoter_slug, tickets.min_price, tickets.ticket_availability, gallery.images FROM events e
      JOIN venues v ON v.id = e.venue_id LEFT JOIN promoters p ON p.id = e.promoter_id ${priceSql} ${gallerySql}
      WHERE e.slug = $1 AND e.is_active = TRUE AND e.deleted_at IS NULL AND e.status IN ('PUBLISHED', 'SOLD_OUT')`,
      [eventSlug],
    );
    return mapEvent(rows[0]);
  },

  async findById(eventId) {
    const { rows } = await getPool().query(
      `SELECT e.*, v.name AS venue_name, v.slug AS venue_slug, v.municipality, v.province, v.latitude AS venue_latitude, v.longitude AS venue_longitude,
      p.name AS promoter_name, p.slug AS promoter_slug, tickets.min_price, tickets.ticket_availability, gallery.images FROM events e
      JOIN venues v ON v.id = e.venue_id LEFT JOIN promoters p ON p.id = e.promoter_id ${priceSql} ${gallerySql} WHERE e.id = $1`,
      [eventId],
    );
    return mapEvent(rows[0]);
  },

  async create(eventData) {
    const entries = Object.entries(eventData).filter(([field]) => eventFields.includes(field));
    const values = entries.map(([, value]) => value);
    const columns = entries.map(([field]) => columnName(field));
    const markers = values.map((_, index) => `$${index + 1}`);
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO events (${columns.join(', ')}) VALUES (${markers.join(', ')}) RETURNING id`, values,
      );
      const images = eventData.images ?? (eventData.posterUrl
        ? [{ url: eventData.posterUrl, altText: eventData.title, sourceUrl: eventData.imageSourceUrl }]
        : []);
      await replaceImages(client, rows[0].id, images);
      await client.query('COMMIT');
      return eventRepository.findById(rows[0].id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async update(eventId, changes) {
    const entries = Object.entries(changes).filter(([field]) =>
      eventFields.includes(field),
    );
    const set = entries
      .map(
        ([field], index) =>
          `${field.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)} = $${index + 2}`,
      );
    if (changes.images !== undefined) set.push('gallery_user_edited = TRUE');
    if (!set.length) return eventRepository.findById(eventId);
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const { rowCount } = await client.query(
        `UPDATE events SET ${set.join(', ')} WHERE id = $1 AND deleted_at IS NULL`,
        [eventId, ...entries.map(([, value]) => value)],
      );
      if (rowCount && changes.images !== undefined) {
        await replaceImages(client, eventId, changes.images);
      }
      await client.query('COMMIT');
      return rowCount ? eventRepository.findById(eventId) : null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async slugExists(eventSlug, excludeId = null) {
    const { rowCount } = await getPool().query(
      'SELECT 1 FROM events WHERE slug = $1 AND ($2::uuid IS NULL OR id <> $2)',
      [eventSlug, excludeId],
    );
    return rowCount > 0;
  },

  async setEventActive(eventId, isActive) {
    const { rowCount } = await getPool().query(
      'UPDATE events SET is_active = $2 WHERE id = $1 AND deleted_at IS NULL',
      [eventId, isActive],
    );
    return rowCount ? eventRepository.findById(eventId) : null;
  },

  async restoreEvent(eventId) {
    const { rowCount } = await getPool().query(
      'UPDATE events SET deleted_at = NULL, is_active = FALSE, updated_at = NOW() WHERE id = $1 AND deleted_at IS NOT NULL',
      [eventId],
    );
    return rowCount ? eventRepository.findById(eventId) : null;
  },
};
