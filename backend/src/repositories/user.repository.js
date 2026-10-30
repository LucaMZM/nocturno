import { crudRepository } from './crud.repository.js';
import { mapUser } from '../models/user.model.js';
import { getPool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
const base = crudRepository('users', ['email', 'displayName', 'passwordHash', 'role', 'isActive', 'promoterId'], mapUser);
export const userRepository = { ...base,
  async updateManaged(id, data, actorId) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(2026, 1030)');
      const { rows: [previous] } = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [id]);
      if (!previous) { await client.query('ROLLBACK'); return null; }
      const nextRole = data.role ?? previous.role;
      const nextActive = data.isActive ?? previous.is_active;
      if (id === actorId && (nextRole !== 'ADMIN' || !nextActive))
        throw new AppError(409, 'SELF_ADMIN_LOCKOUT', 'No puedes retirar tu propio acceso ADMIN');
      const promoterId = nextRole === 'PROMOTER'
        ? (data.promoterId === undefined ? previous.promoter_id : data.promoterId) : null;
      if (nextRole === 'PROMOTER' && !promoterId)
        throw new AppError(422, 'PROMOTER_REQUIRED', 'Selecciona un promotor');
      if (previous.role === 'ADMIN' && previous.is_active && (nextRole !== 'ADMIN' || !nextActive)) {
        const { rows: [count] } = await client.query(
          "SELECT COUNT(*)::int AS total FROM users WHERE role = 'ADMIN' AND is_active = TRUE");
        if (count.total <= 1)
          throw new AppError(409, 'LAST_ADMIN', 'No puedes retirar el último administrador activo');
      }
      const fields = { email: 'email', displayName: 'display_name', role: 'role',
        isActive: 'is_active', promoterId: 'promoter_id' };
      const changes = { ...data, promoterId, ...(data.email ? { email: data.email.toLowerCase() } : {}) };
      const entries = Object.entries(changes).filter(([key]) => fields[key]);
      const assignments = entries.map(([key], i) => `${fields[key]} = $${i+2}`).join(', ');
      const { rows: [updated] } = await client.query(
        `UPDATE users SET ${assignments} WHERE id = $1 RETURNING *`,
        [id, ...entries.map(([, value]) => value)]);
      if (previous.role !== nextRole || (previous.is_active && !nextActive)) {
        await client.query(
          'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [id]);
      }
      await client.query('COMMIT');
      return mapUser(updated);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  },
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
