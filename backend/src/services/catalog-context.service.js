import { yomoganRepository } from '../repositories/yomogan.repository.js';
// Proyección exclusiva de catálogo público, sin acceso a usuarios ni comercio.
export const catalogContextService = {
  locations: () => yomoganRepository.locations(),
  events: ({filters,query,ids}) => yomoganRepository.candidates(filters,query,ids),
};
