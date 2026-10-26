import { profileRepository } from '../repositories/profile.repository.js';
import { AppError } from '../utils/AppError.js';

function requireProfile(user) {
  if (!user?.isActive) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
  return user;
}
export const profileService = {
  async getMine(userId) { return requireProfile(await profileRepository.findById(userId)); },
  async updateMine(userId, { displayName }) {
    return requireProfile(await profileRepository.updateDisplayName(userId, displayName));
  },
};
