import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Pagination } from '../../../core/models/api.model';
import { OwnedTicket } from '../../../core/models/commerce.model';
import { toApiProblem } from '../../../shared/utils/api-error';
import { TicketsApiService } from '../services/tickets-api.service';

interface TicketsState {
  tickets: OwnedTicket[];
  selected: OwnedTicket | null;
  pagination: Pagination;
  loading: boolean;
  error: string | null;
}
const initialState: TicketsState = {
  tickets: [], selected: null, pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  loading: false, error: null
};

export const TicketsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(TicketsApiService)) => {
    let version = 0;
    return {
    async loadTickets(page = 1) {
      const requestVersion = version;
      patchState(store, { loading: true, error: null });
      try {
        const response = await api.getTickets(page);
        if (requestVersion === version)
          patchState(store, { tickets: response.data, pagination: response.pagination, loading: false });
      } catch (error) { if (requestVersion === version) patchState(store, { loading: false,
        error: toApiProblem(error, 'No hemos podido cargar tus entradas.').message }); }
    },
    async loadTicket(ticketId: string) {
      const requestVersion = version;
      patchState(store, { loading: true, error: null, selected: null });
      try { const response = await api.getTicket(ticketId);
        if (requestVersion === version) patchState(store, { selected: response.data, loading: false }); }
      catch (error) { if (requestVersion === version) patchState(store, { loading: false,
        error: toApiProblem(error, 'No hemos podido cargar la entrada.').message }); }
    },
    reset() { version++; patchState(store, initialState); }
  }; })
);
