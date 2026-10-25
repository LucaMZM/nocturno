import { eventRepository } from '../repositories/event.repository.js';
import { venueRepository } from '../repositories/venue.repository.js';
import { promoterRepository } from '../repositories/promoter.repository.js';
import { crudService } from './crud.service.js';
import { AppError } from '../utils/AppError.js';
import { randomBytes } from 'node:crypto';
import { slugFromText } from '../utils/slug.js';
import { eventDeletionService } from './event-deletion.service.js';

const sharedCrudService = crudService(eventRepository, 'EVENT');
const MAX_GENERATED_SLUG_ATTEMPTS = 8;

async function validateEventRelations(eventData) {
  if (
    eventData.venueId &&
    !(await venueRepository.findById(eventData.venueId))
  ) {
    throw new AppError(404, 'VENUE_NOT_FOUND', 'Venue not found');
  }
  if (
    eventData.promoterId &&
    !(await promoterRepository.findById(eventData.promoterId))
  ) {
    throw new AppError(404, 'PROMOTER_NOT_FOUND', 'Promoter not found');
  }
}

function validateEventDates(eventData) {
  if (new Date(eventData.endsAt) <= new Date(eventData.startsAt)) {
    throw new AppError(
      422,
      'VALIDATION_ERROR',
      'endsAt must be after startsAt',
    );
  }
}

function withGalleryCover(eventData) {
  if (eventData.images === undefined) return eventData;
  return {
    ...eventData,
    posterUrl: eventData.images[0]?.url ?? null,
    imageSourceUrl: eventData.images[0]?.sourceUrl ?? null,
  };
}

/** The public slug follows the title, including later title changes. */
export function slugFromTitle(title) {
  return slugFromText(title, 'evento');
}

const eventAlreadyDeletedError = () =>
  new AppError(
    409,
    'EVENT_DELETED',
    'A deleted event cannot be modified or reactivated',
  );

async function writeWithGeneratedSlug(eventData, eventId = null) {
  const stem = slugFromTitle(eventData.title);
  for (let attempt = 0; attempt < MAX_GENERATED_SLUG_ATTEMPTS; attempt++) {
    const slug = attempt ? `${stem}-${randomBytes(4).toString('hex')}` : stem;
    if (await eventRepository.slugExists(slug, eventId)) continue;
    try {
      return eventId
        ? await sharedCrudService.update(eventId, { ...eventData, slug })
        : await sharedCrudService.create({ ...eventData, slug });
    } catch (error) {
      if (error.code !== '23505' || error.constraint !== 'events_slug_key') throw error;
    }
  }
  throw new AppError(409, 'SLUG_CONFLICT', 'Could not generate a unique slug');
}

export const eventService = {
  async getEvents(eventFilters) {
    return eventRepository.findAll(eventFilters);
  },

  async getEventById(eventId) {
    return sharedCrudService.get(eventId);
  },

  async getEventBySlug(eventSlug) {
    const event = await eventRepository.findPublicBySlug(eventSlug);
    if (!event) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    return event;
  },

  async createEvent(eventData) {
    await validateEventRelations(eventData);
    validateEventDates(eventData);
    return writeWithGeneratedSlug(withGalleryCover(eventData));
  },

  async updateEvent(eventId, changes) {
    const currentEvent = await eventService.getEventById(eventId);
    if (currentEvent.deletedAt) throw eventAlreadyDeletedError();
    await validateEventRelations(changes);
    validateEventDates({
      startsAt: changes.startsAt ?? currentEvent.startsAt,
      endsAt: changes.endsAt ?? currentEvent.endsAt,
    });
    const updatedChanges = withGalleryCover(changes);
    if (changes.title && changes.title !== currentEvent.title)
      return writeWithGeneratedSlug(updatedChanges, eventId);
    return sharedCrudService.update(eventId, updatedChanges);
  },

  async setEventActive(eventId, isActive) {
    const currentEvent = await eventService.getEventById(eventId);
    if (currentEvent.deletedAt) throw eventAlreadyDeletedError();
    const updatedEvent = await eventRepository.setEventActive(
      eventId,
      isActive,
    );
    if (!updatedEvent) throw eventAlreadyDeletedError();
    return updatedEvent;
  },

  async softDeleteEvent(eventId, actor) {
    await eventDeletionService.archiveLegacy(eventId, actor);
    return eventRepository.findById(eventId);
  },
  async restoreEvent(eventId) {
    const currentEvent = await eventService.getEventById(eventId);
    if (!currentEvent.deletedAt)
      throw new AppError(409, 'EVENT_NOT_DELETED', 'Event is not deleted');
    const restoredEvent = await eventRepository.restoreEvent(eventId);
    if (!restoredEvent)
      throw new AppError(409, 'EVENT_NOT_DELETED', 'Event is not deleted');
    return restoredEvent;
  },
};
