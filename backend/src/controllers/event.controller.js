import { eventService } from '../services/event.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pagination } from '../utils/pagination.js';
import { AppError } from '../utils/AppError.js';
import { waitlistService } from '../services/waitlist.service.js';
import { eventDeletionService } from '../services/event-deletion.service.js';

// Translate HTTP requests into the explicitly named Event service operations.
export const eventController = {
  deletionImpact: asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ data: await eventDeletionService.preview(req.params.id, req.user) });
  }),
  executeDeletion: asyncHandler(async (req, res) => {
    res.json({ data: await eventDeletionService.execute(req.params.id, req.user, req.validated.body) });
  }),
  getEvents: asyncHandler(async (req, res) => {
    const eventFilters = req.validated.query;
    const eventsPage = await eventService.getEvents(eventFilters);
    res.json({
      data: eventsPage.events,
      pagination: pagination(
        eventFilters.page,
        eventFilters.limit,
        eventsPage.total,
      ),
    });
  }),

  getEventBySlug: asyncHandler(async (req, res) => {
    const event = await eventService.getEventBySlug(req.params.slug);
    res.json({ data: event });
  }),

  getEventById: asyncHandler(async (req, res) => {
    const event = await eventService.getEventById(req.params.id);
    res.json({ data: event });
  }),

  getWaitlistStatus: asyncHandler(async (req, res) =>
    res.json({ data: await waitlistService.getMine(req.params.id, req.user.id) })),

  joinWaitlist: asyncHandler(async (req, res) =>
    res.status(201).json({ data: await waitlistService.join(req.params.id, req.user) })),

  createEvent: asyncHandler(async (req, res) => {
    if (req.user.role === 'PROMOTER' && !req.user.promoterId)
      throw new AppError(403, 'PROMOTER_PROFILE_REQUIRED', 'Promoter profile required');
    const eventData = req.user.role === 'PROMOTER'
      ? { ...req.validated.body, promoterId: req.user.promoterId }
      : req.validated.body;
    const event = await eventService.createEvent(eventData);
    res.status(201).json({ data: event });
  }),

  updateEvent: asyncHandler(async (req, res) => {
    const changes = req.user.role === 'PROMOTER'
      ? { ...req.validated.body, promoterId: req.user.promoterId }
      : req.validated.body;
    const event = await eventService.updateEvent(
      req.params.id,
      changes,
    );
    res.json({ data: event });
  }),

  setEventActive: asyncHandler(async (req, res) => {
    const event = await eventService.setEventActive(
      req.params.id,
      req.validated.body.isActive,
    );
    res.json({ data: event });
  }),

  softDeleteEvent: asyncHandler(async (req, res) => {
    const event = await eventService.softDeleteEvent(req.params.id, req.user);
    res.json({ data: event });
  }),

  restoreEvent: asyncHandler(async (req, res) => {
    const event = await eventService.restoreEvent(req.params.id);
    res.json({ data: event });
  }),

  deleteEvent: asyncHandler(async (req, res) => {
    await eventService.softDeleteEvent(req.params.id, req.user);
    res.status(204).end();
  }),
};
