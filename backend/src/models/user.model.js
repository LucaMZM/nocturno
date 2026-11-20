import { toCamel } from '../utils/mapping.js';
export function mapUser(row) {
  if (!row) return null;
  const { password_hash: _passwordHash, avatar_url: _legacyAvatar, ...safe } = row;
  return toCamel(safe);
}
