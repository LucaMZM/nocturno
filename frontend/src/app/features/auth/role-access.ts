import type { User } from '../../core/models/domain.model';

export function canAccessRole(user: User | null, allowedRoles?: User['role'][]): boolean {
  return !!user && (!allowedRoles || allowedRoles.includes(user.role));
}
