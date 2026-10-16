import { venueRepository } from '../repositories/venue.repository.js';
import { crudService } from './crud.service.js';
import { eventRepository } from '../repositories/event.repository.js';
import { slugFromText } from '../utils/slug.js';
import { AppError } from '../utils/AppError.js';
import { randomBytes } from 'node:crypto';

const base = crudService(venueRepository, 'VENUE');
export const venueService = {
  ...base,
  async create(data) {
    const stem = slugFromText(data.name, 'local');
    for (let attempt = 0; attempt < 8; attempt++) {
      try { return await base.create({ ...data, slug: attempt ? `${stem}-${randomBytes(4).toString('hex')}` : stem }); }
      catch (error) { if (error.code !== '23505' || error.constraint !== 'venues_slug_key') throw error; }
    }
    throw new AppError(409, 'SLUG_CONFLICT', 'Could not generate a venue URL');
  },
  async getPublicProfile(slug) {
    const venue = await venueRepository.findBySlug(slug);
    if (!venue) throw new AppError(404, 'VENUE_NOT_FOUND', 'Venue not found');
    const { events, total } = await eventRepository.findAll({ venueId: venue.id,
      dateFrom: new Date().toISOString(), page: 1, limit: 12, sort: 'date' });
    return { venue, upcomingEvents: events, upcomingTotal: total };
  }
};
