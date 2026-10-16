import { Router } from 'express';
import { eventController } from '../controllers/event.controller.js';
import { ticketTypeController } from '../controllers/ticket-type.controller.js';
import { validate, validateId, listQuery, attendeeListQuery } from '../validators/common.js';
import {
  eventActive,
  eventCreate,
  eventPatch,
  eventQuery,
  eventSlug,
} from '../validators/event.validator.js';
import { ticketTypeCreate } from '../validators/ticket-type.validator.js';
import { optionalAuth, requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import { requireEventManager } from '../middlewares/ownership.middleware.js';
import { ticketController } from '../controllers/ticket.controller.js';
export const eventRoutes = Router();

eventRoutes.get('/', validate(eventQuery, 'query'), eventController.getEvents);
eventRoutes.get(
  '/slug/:slug',
  validate(eventSlug, 'params'),
  eventController.getEventBySlug,
);
eventRoutes.get(
  '/:eventId/ticket-types',
  optionalAuth,
  validateId('eventId'),
  validate(listQuery, 'query'),
  ticketTypeController.listByEvent,
);
eventRoutes.get('/:id', requireAuth, requireRole('ADMIN', 'PROMOTER'), validateId(), requireEventManager, eventController.getEventById);
eventRoutes.get('/:eventId/attendees', requireAuth, requireRole('ADMIN', 'PROMOTER'), validateId('eventId'), requireEventManager, validate(attendeeListQuery, 'query'), ticketController.listAttendees);
eventRoutes.get('/:eventId/check-in', requireAuth, requireRole('ADMIN', 'PROMOTER'), validateId('eventId'), requireEventManager, ticketController.getCheckInOverview);
eventRoutes.get('/:id/waitlist', requireAuth, validateId(), eventController.getWaitlistStatus);
eventRoutes.post('/:id/waitlist', requireAuth, validateId(), eventController.joinWaitlist);

eventRoutes.post('/', requireAuth, requireRole('ADMIN', 'PROMOTER'), validate(eventCreate), eventController.createEvent);
eventRoutes.post(
  '/:eventId/ticket-types',
  requireAuth,
  requireRole('ADMIN', 'PROMOTER'),
  validateId('eventId'),
  requireEventManager,
  validate(ticketTypeCreate),
  ticketTypeController.createForEvent,
);

eventRoutes.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'PROMOTER'),
  validateId(),
  requireEventManager,
  validate(eventPatch),
  eventController.updateEvent,
);
eventRoutes.patch(
  '/:id/active',
  requireAuth,
  requireRole('ADMIN', 'PROMOTER'),
  validateId(),
  requireEventManager,
  validate(eventActive),
  eventController.setEventActive,
);
eventRoutes.patch(
  '/:id/soft-delete',
  requireAuth,
  requireRole('ADMIN', 'PROMOTER'),
  validateId(),
  requireEventManager,
  eventController.softDeleteEvent,
);
eventRoutes.patch('/:id/restore', requireAuth, requireRole('ADMIN'), validateId(),
  requireEventManager, eventController.restoreEvent);

// Keep the existing DELETE contract as a soft-delete alias for older clients.
eventRoutes.delete('/:id', requireAuth, requireRole('ADMIN', 'PROMOTER'), validateId(), requireEventManager, eventController.deleteEvent);
