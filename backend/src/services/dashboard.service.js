import { dashboardRepository } from '../repositories/dashboard.repository.js';
import { AppError } from '../utils/AppError.js';

export const dashboardService = {
  getSummary: (actor) => dashboardRepository.getSummary(actor),
  listEvents: (actor, query) => {
    if (query.deleted === 'only' && actor.role !== 'ADMIN')
      throw new AppError(403, 'FORBIDDEN', 'Only administrators can view deleted events');
    return dashboardRepository.listEvents(actor, query);
  },
  listSales: (actor, query) => dashboardRepository.listSales(actor, query),
  listTopEvents: (actor, sort) => dashboardRepository.listTopEvents(actor, sort)
};
