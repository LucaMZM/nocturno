import { entityRemovalRepository } from '../repositories/entity-removal.repository.js';
import { ticketTypeRepository } from '../repositories/ticket-type.repository.js';
import { eventRepository } from '../repositories/event.repository.js';
import { crudService } from './crud.service.js';
import { AppError } from '../utils/AppError.js';

const base = crudService(ticketTypeRepository, 'TICKET_TYPE');
export function checkTicketType(data) {
  if ((data.sold ?? 0) + (data.reserved ?? 0) > data.quantity)
    throw new AppError(422, 'VALIDATION_ERROR', 'sold plus reserved cannot exceed quantity');
  if (data.salesStart && data.salesEnd && new Date(data.salesEnd) <= new Date(data.salesStart))
    throw new AppError(422, 'VALIDATION_ERROR', 'salesEnd must be after salesStart');
}
async function requireEvent(eventId) {
  const event = await eventRepository.findById(eventId);
  if (!event) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
  if (event.deletedAt) throw new AppError(409, 'EVENT_DELETED', 'A deleted event cannot be managed');
}
export const ticketTypeService = {
  ...base,
  async remove(id) {
    const result = await entityRemovalRepository.removeTicketType(id);
    if (!result.found) throw new AppError(404, 'TICKET_TYPE_NOT_FOUND', 'Resource not found');
    if (!result.deleted) throw new AppError(409, 'TICKET_TYPE_HAS_DEPENDENCIES', 'No se puede eliminar: existen relaciones que deben conservarse.', {
      dependencies: result.dependencies,
      recommendation: 'Desactiva el tipo de entrada mediante active=false para conservar ventas, reservas e histórico.'
    });
  },

  async listByEvent(eventId, query, actor) {
    const event = await eventRepository.findById(eventId);
    if (!event) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    const publicEvent = event.isActive && !event.deletedAt && ['PUBLISHED', 'SOLD_OUT'].includes(event.status);
    const managedEvent = actor && (actor.role === 'ADMIN' ||
      (actor.role === 'PROMOTER' && actor.promoterId && actor.promoterId === event.promoterId));
    if (!publicEvent && !managedEvent) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    return ticketTypeRepository.listByEvent(eventId, query);
  },
  async createForEvent(eventId, data) { await requireEvent(eventId); checkTicketType(data); return base.create({ ...data, eventId }); },
  async update(id, data) { const current = await base.get(id); checkTicketType({ ...current, ...data }); return base.update(id, data); }
};
