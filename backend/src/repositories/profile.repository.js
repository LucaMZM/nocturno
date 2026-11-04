import { getPool } from '../config/db.js';
import { userRepository } from './user.repository.js';
import { mapUser } from '../models/user.model.js';

export const profileRepository = {
  findById: (userId) => userRepository.findById(userId),
  async updateMine(userId, data) {
    const fields = { displayName: 'display_name', avatarUrl: 'avatar_url' };
    const entries = Object.entries(data).filter(([key]) => fields[key]);
    const assignments = entries.map(([key], index) => `${fields[key]}=$${index+2}`).join(', ');
    const { rows } = await getPool().query(`UPDATE users SET ${assignments}
      WHERE id=$1 AND is_active=TRUE
      RETURNING id,email,display_name,avatar_url,role,is_active,promoter_id,created_at,updated_at`,
      [userId, ...entries.map(([, value]) => value)]);
    return mapUser(rows[0]);
  },
};
