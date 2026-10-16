import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Pagination } from '../../../core/models/api.model';
import { Event } from '../../../core/models/domain.model';
import { toApiProblem } from '../../../shared/utils/api-error';
import { Attendee, CheckInOverview, DashboardApiService, DashboardSummary, Sale } from '../services/dashboard-api.service';
import { EventsApiService } from '../../events/services/events-api.service';
import { TicketsApiService } from '../../tickets/services/tickets-api.service';
import { HttpErrorResponse } from '@angular/common/http';

const emptyPagination: Pagination = { page: 1, limit: 20, total: 0, totalPages: 0 };
interface DashboardState {
  summary: DashboardSummary | null;
  events: Event[];
  sales: Sale[];
  attendees: Attendee[];
  checkInOverview: CheckInOverview | null;
  checkInResult: Attendee | null;
  checkInMessage: string | null;
  checkingIn: boolean;
  pagination: Pagination;
  loading: boolean;
  saving: boolean;
  error: string | null;
}
const initialState: DashboardState = { summary: null, events: [], sales: [], attendees: [],
  checkInOverview: null, checkInResult: null, checkInMessage: null, checkingIn: false,
  pagination: emptyPagination, loading: false, saving: false, error: null };

export const DashboardStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(DashboardApiService), eventsApi = inject(EventsApiService), ticketsApi = inject(TicketsApiService)) => {
    let version = 0;
    const requestIds = { summary: 0, events: 0, sales: 0, attendees: 0 };
    async function load<T>(request: () => Promise<{ data: T; pagination?: Pagination }>, key: 'summary' | 'events' | 'sales' | 'attendees') {
      const requestVersion = version;
      const currentRequest = ++requestIds[key];
      patchState(store, { loading: true, error: null });
      try {
        const response = await request();
        if (requestVersion === version && currentRequest === requestIds[key])
          patchState(store, { [key]: response.data, pagination: response.pagination ?? emptyPagination,
            loading: false });
      } catch (error) {
        if (requestVersion === version && currentRequest === requestIds[key]) patchState(store, { loading: false,
          error: toApiProblem(error, 'No hemos podido cargar la gestión.').message });
      }
    }
    return {
      loadSummary: () => load(() => api.getSummary(), 'summary'),
      loadEvents: (page = 1, search = '', status = '', deleted: 'exclude' | 'only' = 'exclude', active: 'all' | 'true' | 'false' = 'all') =>
        load(() => api.getEvents(page, search, status, deleted, active), 'events'),
      loadSales: (page = 1, eventId?: string, search = '') => load(() => api.getSales(page, eventId, search), 'sales'),
      loadAttendees: (eventId: string, page = 1, search = '') => load(() => api.getAttendees(eventId, page, search), 'attendees'),
      async loadCheckInOverview(eventId: string) {
        try { patchState(store, { checkInOverview: (await api.getCheckInOverview(eventId)).data }); }
        catch (error) { patchState(store, { error: toApiProblem(error, 'No hemos podido cargar el control de acceso.').message }); }
      },
      async checkIn(code: string, eventId: string) {
        patchState(store, { checkingIn: true, checkInMessage: null, checkInResult: null });
        try {
          const ticket = (await ticketsApi.checkIn(code, eventId)).data;
          patchState(store, { checkingIn: false, checkInResult: ticket,
            checkInMessage: `Entrada válida · ${ticket.displayName} · ${ticket.ticketTypeName}` });
          try { patchState(store, { checkInOverview: (await api.getCheckInOverview(eventId)).data }); }
          catch { /* The admission succeeded; a statistics refresh must not reverse its result. */ }
          return true;
        } catch (error) {
          const body = error instanceof HttpErrorResponse ? error.error as { error?: { code?: string; details?: { usedAt?: string } } } : null;
          const code = body?.error?.code;
          const message = code === 'TICKET_ALREADY_USED'
            ? `Entrada ya utilizada${body?.error?.details?.usedAt ? ` · ${new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(body.error.details.usedAt))}` : ''}`
            : code === 'TICKET_CANCELLED' ? 'Entrada cancelada o reembolsada'
            : code === 'WRONG_EVENT' ? 'La entrada pertenece a otro evento'
            : code === 'TICKET_NOT_FOUND' ? 'Código de entrada no válido'
            : toApiProblem(error, 'No hemos podido validar la entrada.').message;
          patchState(store, { checkingIn: false, checkInMessage: message });
          return false;
        }
      },
      async softDeleteEvent(eventId: string): Promise<boolean> {
        patchState(store, { saving: true, error: null });
        try { await eventsApi.softDeleteEvent(eventId); patchState(store, { saving: false }); return true; }
        catch (error) { patchState(store, { saving: false,
          error: toApiProblem(error, 'No hemos podido eliminar el evento.').message }); return false; }
      },
      async restoreEvent(eventId: string): Promise<boolean> {
        patchState(store, { saving: true, error: null });
        try { await eventsApi.restoreEvent(eventId); patchState(store, { saving: false }); return true; }
        catch (error) { patchState(store, { saving: false,
          error: toApiProblem(error, 'No hemos podido restaurar el evento.').message }); return false; }
      },
      async setEventActive(eventId: string, isActive: boolean): Promise<boolean> {
        patchState(store, { saving: true, error: null });
        try { await eventsApi.setEventActive(eventId, isActive); patchState(store, { saving: false }); return true; }
        catch (error) { patchState(store, { saving: false,
          error: toApiProblem(error, 'No hemos podido cambiar la actividad del evento.').message }); return false; }
      },
      reset() { version++; patchState(store, initialState); }
    };
  })
);
