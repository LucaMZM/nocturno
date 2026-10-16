import { favoriteRepository } from '../repositories/favorite.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { eventRepository } from '../repositories/event.repository.js';
import { AppError } from '../utils/AppError.js';
async function requireUser(id) { if (!await userRepository.findById(id)) throw new AppError(404, 'USER_NOT_FOUND', 'User not found'); }
export const favoriteService = {
  async list(userId, query) { await requireUser(userId); return favoriteRepository.list(userId, query); },
  async add(userId, eventId) {
    await requireUser(userId);
    const event = await eventRepository.findById(eventId);
    if (!event || !event.isActive || event.deletedAt || !['PUBLISHED', 'SOLD_OUT'].includes(event.status)) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    const item = await favoriteRepository.add(userId, eventId);
    if (!item) throw new AppError(409, 'DUPLICATE_FAVORITE', 'Favorite already exists');
    return { userId, eventId, createdAt: item.created_at };
  },
  async remove(userId, eventId) {
    await requireUser(userId);
    if (!await favoriteRepository.remove(userId, eventId)) throw new AppError(404, 'NOT_FOUND', 'Favorite not found');
  }
};
