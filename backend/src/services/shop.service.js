import { shopRepository } from '../repositories/shop.repository.js';
import { eventService } from './event.service.js';

export const shopService = {
  categories: () => shopRepository.categories(),
  hosts: () => shopRepository.hosts(),
  locations: () => shopRepository.locations(),
  events: (filters) => shopRepository.findEvents(filters),
  detail: (slug) => eventService.getEventBySlug(slug),
  async variants(slug) {
    const event = await eventService.getEventBySlug(slug);
    const variants = await shopRepository.variants(event.id);
    const now = Date.now();
    return variants.map((ticket) => ({
      ...ticket,
      purchasable: event.status === 'PUBLISHED' && new Date(event.endsAt).getTime() > now &&
        ticket.available > 0 &&
        (!ticket.salesStart || new Date(ticket.salesStart).getTime() <= now) &&
        (!ticket.salesEnd || new Date(ticket.salesEnd).getTime() > now),
    }));
  },
};
