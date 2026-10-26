import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Pagination } from '../../../core/models/api.model';
import { Event } from '../../../core/models/domain.model';
import { Order, OwnedTicket } from '../../../core/models/commerce.model';
import { toApiProblem } from '../../../shared/utils/api-error';
import { AdminApiService, Payment } from '../services/admin-api.service';
import { DashboardApiService } from '../../dashboard/services/dashboard-api.service';

interface AdminState { orders: Order[]; payments: Payment[]; tickets: OwnedTicket[]; eventOptions: Event[];
  pagination: Pagination; loading: boolean; saving: boolean; error: string | null; }
const initialState: AdminState = { orders: [], payments: [], tickets: [], eventOptions: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }, loading: false, saving: false, error: null };

export const AdminStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(AdminApiService), dashboardApi = inject(DashboardApiService)) => {
    async function load<T>(request: () => Promise<{ data: T; pagination: Pagination }>,
      key: 'orders' | 'payments' | 'tickets') {
      patchState(store, { loading: true, error: null });
      try { const response = await request();
        patchState(store, { [key]: response.data, pagination: response.pagination, loading: false }); }
      catch (error) { patchState(store, { [key]: [], loading: false,
        error: toApiProblem(error, 'No hemos podido cargar los datos.').message }); }
    }
    return {
      async loadEventOptions() {
        try { patchState(store, { eventOptions: (await dashboardApi.getEventOptions()).data }); }
        catch { /* Order filters remain usable by status, search and date. */ }
      },
      loadOrders: (page = 1, search = '', status = '', eventId = '', dateFrom = '', dateTo = '') =>
        load(() => api.getOrders(page, search, status, eventId, dateFrom, dateTo), 'orders'),
      loadPayments: (page = 1, search = '', status = '', dateFrom = '', dateTo = '') =>
        load(() => api.getPayments(page, search, status, dateFrom, dateTo), 'payments'),
      loadTickets: (page = 1, search = '', status = '') => load(() => api.getTickets(page, search, status), 'tickets'),
      async requestRefund(paymentId: string) {
        patchState(store, { saving: true, error: null });
        try { await api.requestRefund(paymentId); patchState(store, { saving: false }); return true; }
        catch (error) { patchState(store, { saving: false,
          error: toApiProblem(error, 'No hemos podido solicitar el reembolso. Comprueba las claves Stripe y el estado del pago.').message }); return false; }
      }
    };
  })
);
