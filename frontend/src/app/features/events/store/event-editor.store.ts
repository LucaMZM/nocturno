import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { PaginatedResponse } from '../../../core/models/api.model';
import { Event, EventWritePayload, Promoter, Venue } from '../../../core/models/domain.model';
import { PromotersApiService } from '../../../core/services/promoters-api.service';
import { VenuesApiService } from '../../../core/services/venues-api.service';
import { toApiProblem } from '../../../shared/utils/api-error';
import { EventsApiService } from '../services/events-api.service';

interface EditorState {
  event: Event | null;
  venues: Venue[];
  promoters: Promoter[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: EditorState = {
  event: null,
  venues: [],
  promoters: [],
  loading: false,
  saving: false,
  error: null,
};

async function loadAllPages<T>(
  loadPage: (page: number) => Promise<PaginatedResponse<T>>,
): Promise<T[]> {
  const firstPage = await loadPage(1);
  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.pagination.totalPages - 1 }, (_, index) => loadPage(index + 2)),
  );
  return [firstPage, ...remainingPages].flatMap((page) => page.data);
}

export const EventEditorStore = signalStore(
  withState(initialState),
  withMethods(
    (
      store,
      events = inject(EventsApiService),
      venues = inject(VenuesApiService),
      promoters = inject(PromotersApiService),
    ) => ({
      async load(eventId: string | null) {
        patchState(store, { loading: true, error: null });
        try {
          const [eventResponse, venueOptions, promoterOptions] = await Promise.all([
            eventId ? events.getEventById(eventId) : Promise.resolve(null),
            loadAllPages((page) => venues.getVenues(page)),
            loadAllPages((page) => promoters.getPromoters(page)),
          ]);
          patchState(store, {
            event: eventResponse?.data ?? null,
            venues: venueOptions,
            promoters: promoterOptions,
            loading: false,
          });
        } catch (error) {
          patchState(store, {
            error: toApiProblem(error, 'No hemos podido cargar el formulario.').message,
            loading: false,
          });
        }
      },
      async save(eventId: string | null, payload: EventWritePayload): Promise<Event | null> {
        patchState(store, { saving: true, error: null });
        try {
          const response = eventId
            ? await events.updateEvent(eventId, payload)
            : await events.createEvent(payload);
          patchState(store, { event: response.data, saving: false });
          return response.data;
        } catch (error) {
          patchState(store, {
            error: toApiProblem(
              error,
              'No hemos podido guardar el evento. Revisa los datos e inténtalo de nuevo.',
            ).message,
            saving: false,
          });
          return null;
        }
      },
    }),
  ),
);
