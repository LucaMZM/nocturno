import { crudRepository } from './crud.repository.js';
import { mapVenue } from '../models/venue.model.js';
import { getPool } from '../config/db.js';
const base = crudRepository('venues', ['name', 'slug', 'description', 'type', 'province', 'municipality', 'zone', 'address', 'postalCode', 'latitude', 'longitude', 'capacity', 'minimumAge', 'websiteUrl', 'imageUrl'], mapVenue);
export const venueRepository = {
  ...base,
  async findBySlug(slug) {
    const { rows } = await getPool().query('SELECT * FROM venues WHERE slug = $1', [slug]);
    return mapVenue(rows[0]);
  }
};
