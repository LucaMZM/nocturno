import { eventRepository } from '../repositories/event.repository.js';
import { ticketTypeRepository } from '../repositories/ticket-type.repository.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function canManageEvent(user, event) {
  return user.role === 'ADMIN' ||
    (user.role === 'PROMOTER' && user.promoterId && user.promoterId === event.promoterId);
}

export const requireEventManager = asyncHandler(async (req, _res, next) => {
  const event = await eventRepository.findById(req.params.eventId ?? req.params.id);
  if (!event) return next(new AppError(404, 'EVENT_NOT_FOUND', 'Event not found'));
  if (!canManageEvent(req.user, event))
    return next(new AppError(403, 'FORBIDDEN', 'You cannot manage this event'));
  next();
});

export const requireTicketTypeManager = asyncHandler(async (req, _res, next) => {
  const ticketType = await ticketTypeRepository.findById(req.params.id);
  if (!ticketType) return next(new AppError(404, 'TICKET_TYPE_NOT_FOUND', 'Ticket type not found'));
  const event = await eventRepository.findById(ticketType.eventId);
  if (!event || !canManageEvent(req.user, event))
    return next(new AppError(403, 'FORBIDDEN', 'You cannot manage this ticket type'));
  if (req.method !== 'GET' && event.deletedAt)
    return next(new AppError(409, 'EVENT_DELETED', 'A deleted event cannot be managed'));
  next();
});

export function requireOwnOrAdmin(parameter = 'userId') {
  return (req, _res, next) => {
    if (req.user.role !== 'ADMIN' && req.user.id !== req.params[parameter])
      return next(new AppError(403, 'FORBIDDEN', 'You cannot access another account'));
    next();
  };
}

export function requireOwnPromoter(req, _res, next) {
  if (req.user.role !== 'ADMIN' && req.user.promoterId !== req.params.id)
    return next(new AppError(403, 'FORBIDDEN', 'You cannot manage another promoter'));
  next();
}
