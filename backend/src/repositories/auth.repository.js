import { getPool } from '../config/db.js';

const publicColumns = 'id, email, display_name, role, is_active, promoter_id, created_at, updated_at';

export const authRepository = {
  async findByEmail(email) {
    const { rows } = await getPool().query(
      `SELECT ${publicColumns}, password_hash FROM users WHERE email = $1`, [email]);
    return rows[0] ?? null;
  },
  async findById(userId) {
    const { rows } = await getPool().query(
      `SELECT ${publicColumns} FROM users WHERE id = $1`, [userId]);
    return rows[0] ?? null;
  },
  async createUser({ email, displayName, passwordHash }) {
    const { rows } = await getPool().query(
      `INSERT INTO users (email, display_name, password_hash)
       VALUES ($1, $2, $3) RETURNING ${publicColumns}`,
      [email, displayName, passwordHash]);
    return rows[0];
  },
  async storeRefreshToken({ userId, tokenHash, familyId, expiresAt }) {
    await getPool().query(
      `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
       VALUES ($1, $2, $3, $4)`, [userId, tokenHash, familyId, expiresAt]);
  },
  async rotateRefreshToken(oldHash, newHash, expiresAt) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'SELECT * FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE', [oldHash]);
      const oldToken = rows[0];
      if (!oldToken) {
        await client.query('COMMIT');
        return null;
      }
      if (oldToken.revoked_at) {
        await client.query(
          'UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = $1 AND revoked_at IS NULL',
          [oldToken.family_id]);
        await client.query('COMMIT');
        return null;
      }
      if (oldToken.expires_at <= new Date()) {
        await client.query('COMMIT');
        return null;
      }
      const { rows: users } = await client.query(
        `SELECT ${publicColumns} FROM users WHERE id = $1 AND is_active = TRUE`,
        [oldToken.user_id]);
      if (!users[0]) {
        await client.query('COMMIT');
        return null;
      }
      await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [oldToken.id]);
      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [oldToken.user_id, newHash, oldToken.family_id, expiresAt]);
      await client.query('COMMIT');
      return users[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  },
  async revokeRefreshFamily(tokenHash) {
    await getPool().query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE family_id = (SELECT family_id FROM refresh_tokens WHERE token_hash = $1)
         AND revoked_at IS NULL`, [tokenHash]);
  }
};
