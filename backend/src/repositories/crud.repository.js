import { getPool } from '../config/db.js';

// Table and column names come only from fixed definitions in source code.
export function crudRepository(table, fields, map) {
  const columns = new Set(fields);
  function assignment(data, start = 1) {
    const entries = Object.entries(data).filter(([key]) => columns.has(key));
    return { entries, set: entries.map(([key], index) => `${key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)} = $${index + start}`).join(', ') };
  }
  return {
    async findById(id) {
      const { rows } = await getPool().query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
      return map(rows[0]);
    },
    async list({ page, limit }) {
      const { rows } = await getPool().query(`SELECT *, count(*) OVER() AS total_count FROM ${table} ORDER BY created_at DESC, id LIMIT $1 OFFSET $2`, [limit, (page - 1) * limit]);
      const total = rows.length ? Number(rows[0].total_count) : Number((await getPool().query(`SELECT count(*) AS total FROM ${table}`)).rows[0].total);
      return { rows: rows.map((row) => { const { total_count, ...rest } = row; return map(rest); }), total };
    },
    async create(data) {
      const { entries } = assignment(data);
      const keys = entries.map(([key]) => key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`));
      const values = entries.map(([, value]) => value);
      const markers = values.map((_, index) => `$${index + 1}`);
      const { rows } = await getPool().query(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${markers.join(', ')}) RETURNING *`, values);
      return map(rows[0]);
    },
    async update(id, data) {
      const { entries, set } = assignment(data, 2);
      const { rows } = await getPool().query(`UPDATE ${table} SET ${set} WHERE id = $1 RETURNING *`, [id, ...entries.map(([, value]) => value)]);
      return map(rows[0]);
    },
    async remove(id) {
      const { rowCount } = await getPool().query(`DELETE FROM ${table} WHERE id = $1`, [id]);
      return rowCount > 0;
    }
  };
}
