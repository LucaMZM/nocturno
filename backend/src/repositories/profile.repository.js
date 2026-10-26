import { getPool } from '../config/db.js';
import { userRepository } from './user.repository.js';
import { mapUser } from '../models/user.model.js';

export const profileRepository = {
  findById: (userId) => userRepository.findById(userId),
  async updateDisplayName(userId, displayName) {
    const { rows } = await getPool().query(`UPDATE users SET display_name=$2
      WHERE id=$1 AND is_active=TRUE
      RETURNING id,email,display_name,role,is_active,promoter_id,created_at,updated_at`,
    [userId, displayName]);
    return mapUser(rows[0]);
  },
};
