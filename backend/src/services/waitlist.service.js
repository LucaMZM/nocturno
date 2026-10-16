import { waitlistRepository } from '../repositories/waitlist.repository.js';
import { AppError } from '../utils/AppError.js';

export const waitlistService = {
  async getMine(eventId, userId) {
    return { joined: Boolean(await waitlistRepository.find(eventId, userId)) };
  },
  async join(eventId, user) {
    const event = await waitlistRepository.availability(eventId);
    if (!event || event.deletedAt || !event.isActive ||
      !['PUBLISHED', 'SOLD_OUT'].includes(event.status) || new Date(event.endsAt) <= new Date())
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event is not available');
    if (!event.ticketTypes || event.available > 0)
      throw new AppError(409, 'TICKETS_AVAILABLE', 'Tickets are currently available');
    const entry = await waitlistRepository.join(eventId, user);
    return { joined: true, createdAt: entry.createdAt };
  }
};
