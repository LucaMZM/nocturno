import { crudRepository } from './crud.repository.js';
import { mapUser } from '../models/user.model.js';
import { getPool } from '../config/db.js';
const base = crudRepository('users', ['email', 'displayName', 'passwordHash', 'role', 'isActive', 'promoterId'], mapUser);
export const userRepository = { ...base,
  async list({ page, limit, search, role }) {
    const params = [search ? `%${search}%` : null, role ?? null];
    const where = `WHERE ($1::text IS NULL OR display_name ILIKE $1 OR email ILIKE $1)
      AND ($2::text IS NULL OR role = $2)`;
    const { rows } = await getPool().query(
      `SELECT *, count(*) OVER() AS total_count FROM users ${where}
       ORDER BY created_at DESC, id LIMIT $3 OFFSET $4`, [...params, limit, (page - 1) * limit]);
    const total = rows.length ? Number(rows[0].total_count)
      : Number((await getPool().query(`SELECT count(*) AS total FROM users ${where}`, params)).rows[0].total);
    return { rows: rows.map(({ total_count: _count, ...row }) => mapUser(row)), total };
  }
};
