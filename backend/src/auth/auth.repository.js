import { AppError } from '../utils/AppError.js';
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
  async isSessionActive(userId, familyId) {
    const { rows } = await getPool().query(
      `SELECT EXISTS (
        SELECT 1 FROM refresh_tokens
        WHERE user_id = $1 AND family_id = $2 AND revoked_at IS NULL AND expires_at > NOW()
      ) AS active`, [userId, familyId]);
    return rows[0].active;
  },
  async createUser({ email, displayName, passwordHash }) {
    const { rows } = await getPool().query(
      `INSERT INTO users (email, display_name, password_hash)
       VALUES ($1, $2, $3) RETURNING ${publicColumns}`,
      [email, displayName, passwordHash]);
    return rows[0];
  },
  async storeRefreshToken({ userId, role, tokenHash, familyId, expiresAt }) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const { rows: [user] } = await client.query('SELECT role,is_active FROM users WHERE id=$1 FOR UPDATE', [userId]);
      if (!user?.is_active || user.role !== role) throw new AppError(401, 'UNAUTHENTICATED', 'Sign in again');
      await client.query(`INSERT INTO refresh_tokens(user_id,token_hash,family_id,expires_at)
        VALUES($1,$2,$3,$4)`, [userId,tokenHash,familyId,expiresAt]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  },
  async rotateRefreshToken(oldHash, newHash, expiresAt) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const { rows: [owner] } = await client.query('SELECT user_id FROM refresh_tokens WHERE token_hash=$1', [oldHash]);
      if (owner) await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [owner.user_id]);
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
      return { ...users[0], session_family_id: oldToken.family_id };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  },
  async findAuthenticatedUser({ sub, sid, jti, role }) {
    const { rows } = await getPool().query(`SELECT ${publicColumns} FROM users u
      WHERE u.id=$1 AND u.is_active=TRUE AND u.role=$4
        AND EXISTS (SELECT 1 FROM refresh_tokens WHERE user_id=u.id AND family_id=$2
          AND revoked_at IS NULL AND expires_at>NOW())
        AND NOT EXISTS (SELECT 1 FROM revoked_access_tokens WHERE jti=$3)`, [sub, sid, jti, role]);
    return rows[0] ?? null;
  },
  async revokeSession(tokenHash, claims) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const { rows: [refresh] } = tokenHash ? await client.query(
        'SELECT user_id, family_id FROM refresh_tokens WHERE token_hash=$1', [tokenHash]) : { rows: [] };
      // Same user-first lock order as rotation and administrative updates.
      const ids = [...new Set([refresh?.user_id, claims?.sub].filter(Boolean))].sort();
      await client.query('SELECT id FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [ids]);
      for (const session of [refresh, claims && { user_id: claims.sub, family_id: claims.sid }].filter(Boolean)) {
        await client.query('UPDATE refresh_tokens SET revoked_at=NOW() WHERE user_id=$1 AND family_id=$2 AND revoked_at IS NULL',
          [session.user_id, session.family_id]);
      }
      if (claims) await client.query(`INSERT INTO revoked_access_tokens(jti,user_id,expires_at,reason)
        SELECT $1,id,to_timestamp($3),'logout' FROM users WHERE id=$2 ON CONFLICT(jti) DO NOTHING`,
        [claims.jti, claims.sub, claims.exp]);
      await client.query('DELETE FROM revoked_access_tokens WHERE expires_at <= NOW()');
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
};
