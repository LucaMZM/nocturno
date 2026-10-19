import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Event, Promoter, TicketType, Venue } from '../../../core/models/domain.model';
import { PromotersApiService } from '../../../core/services/promoters-api.service';
import { TicketTypesApiService } from '../../../core/services/ticket-types-api.service';
import { VenuesApiService } from '../../../core/services/venues-api.service';
import { toApiProblem } from '../../../shared/utils/api-error';
import { EventsApiService } from '../services/events-api.service';
import { AuthStore } from '../../auth/store/auth.store';

// STATE: related data loaded only after the public event has been resolved by slug.
interface DetailState {
  venue: Venue | null;
  promoter: Promoter | null;
  tickets: TicketType[];
  loading: boolean;
  error: string | null;
  joinedWaitlist: boolean;
  waitlistPending: boolean;
  waitlistMessage: string | null;
}
const initialState: DetailState = {
  venue: null,
  promoter: null,
  tickets: [],
  loading: false,
  error: null,
  joinedWaitlist: false,
  waitlistPending: false,
  waitlistMessage: null,
};

export const EventDetailStore = signalStore(
  withState(initialState),
  // METHODS
  withMethods(
    (
      store,
      venues = inject(VenuesApiService),
      promoters = inject(PromotersApiService),
      ticketTypes = inject(TicketTypesApiService),
      eventsApi = inject(EventsApiService),
      auth = inject(AuthStore),
    ) => {
      let latestRequestId = 0;
      return {
        /** Keep the venue, promoter and tickets from the same selected event. */
        async loadEventRelations(event: Event) {
          const requestId = ++latestRequestId;
          patchState(store, {
            venue: null,
            promoter: null,
            tickets: [],
            joinedWaitlist: false,
            waitlistPending: false,
            waitlistMessage: null,
            loading: true,
            error: null,
          });
          try {
            const [venue, promoter, tickets] = await Promise.all([
              venues.getVenue(event.venueId),
              event.promoterId ? promoters.getPromoter(event.promoterId) : Promise.resolve(null),
              ticketTypes.getByEvent(event.id),
            ]);
            if (requestId === latestRequestId)
              patchState(store, {
                venue: venue.data,
                promoter: promoter?.data ?? null,
                tickets: tickets.data,
                loading: false,
              });
            if (requestId === latestRequestId && auth.user()) {
              try {
                const status = await eventsApi.getWaitlistStatus(event.id);
                if (requestId === latestRequestId) patchState(store, { joinedWaitlist: status.data.joined });
              } catch { /* Event details remain usable when waitlist status is unavailable. */ }
            }
          } catch (error) {
            if (requestId === latestRequestId)
              patchState(store, {
                error: toApiProblem(error, 'No hemos podido cargar todos los detalles.').message,
                loading: false,
              });
          }
        },
        async joinWaitlist(eventId: string) {
          if (store.waitlistPending()) return;
          const requestId = latestRequestId;
          patchState(store, { waitlistPending: true, waitlistMessage: null });
          try {
            await eventsApi.joinWaitlist(eventId);
            if (requestId !== latestRequestId) return;
            patchState(store, { joinedWaitlist: true, waitlistPending: false,
              waitlistMessage: 'Te has unido a la lista de espera. No se enviará ningún correo automático.' });
          } catch (error) {
            if (requestId !== latestRequestId) return;
            const problem = toApiProblem(error, 'No hemos podido apuntarte a la lista de espera.');
            patchState(store, { waitlistPending: false,
              waitlistMessage: problem.code === 'TICKETS_AVAILABLE' ? 'Hay entradas disponibles ahora mismo.' : problem.message });
          }
        },
      };
    },
  ),
);
