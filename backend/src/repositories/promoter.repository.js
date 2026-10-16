import { crudRepository } from './crud.repository.js';
import { mapPromoter } from '../models/promoter.model.js';
import { getPool } from '../config/db.js';
const base = crudRepository('promoters', ['name', 'slug', 'description', 'email', 'phone', 'websiteUrl'], mapPromoter);
export const promoterRepository = {
  ...base,
  async findBySlug(slug) {
    const { rows } = await getPool().query('SELECT * FROM promoters WHERE slug = $1', [slug]);
    return mapPromoter(rows[0]);
  }
};
