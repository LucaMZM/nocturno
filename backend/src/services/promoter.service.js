import { entityRemovalRepository } from '../repositories/entity-removal.repository.js';
import { promoterRepository } from '../repositories/promoter.repository.js';
import { crudService } from './crud.service.js';
import { eventRepository } from '../repositories/event.repository.js';
import { slugFromText } from '../utils/slug.js';
import { AppError } from '../utils/AppError.js';
import { randomBytes } from 'node:crypto';

const base = crudService(promoterRepository, 'PROMOTER');
export const promoterService = {
  ...base,
  async remove(id) {
    const result = await entityRemovalRepository.removePromoter(id);
    if (!result.found) throw new AppError(404, 'PROMOTER_NOT_FOUND', 'Resource not found');
    if (!result.deleted) throw new AppError(409, 'PROMOTER_HAS_DEPENDENCIES', 'No se puede eliminar: existen relaciones que deben conservarse.', {
      dependencies: result.dependencies,
      recommendation: 'Conserva el promotor mientras existan eventos o usuarios propietarios; revisa esas relaciones explícitamente.'
    });
  },

  async create(data) {
    const stem = slugFromText(data.name, 'promotor');
    for (let attempt = 0; attempt < 8; attempt++) {
      try { return await base.create({ ...data, slug: attempt ? `${stem}-${randomBytes(4).toString('hex')}` : stem }); }
      catch (error) { if (error.code !== '23505' || error.constraint !== 'promoters_slug_key') throw error; }
    }
    throw new AppError(409, 'SLUG_CONFLICT', 'Could not generate a promoter URL');
  },
  async getPublicProfile(slug) {
    const promoter = await promoterRepository.findBySlug(slug);
    if (!promoter) throw new AppError(404, 'PROMOTER_NOT_FOUND', 'Promoter not found');
    const { events, total } = await eventRepository.findAll({ promoterId: promoter.id,
      dateFrom: new Date().toISOString(), page: 1, limit: 12, sort: 'date' });
    return { promoter, upcomingEvents: events, upcomingTotal: total };
  }
};
