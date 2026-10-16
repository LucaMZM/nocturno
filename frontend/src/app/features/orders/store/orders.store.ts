import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Pagination } from '../../../core/models/api.model';
import { Order } from '../../../core/models/commerce.model';
import { toApiProblem } from '../../../shared/utils/api-error';
import { OrdersApiService } from '../services/orders-api.service';

interface OrdersState {
  orders: Order[];
  selected: Order | null;
  pagination: Pagination;
  loading: boolean;
  error: string | null;
}
const initialState: OrdersState = {
  orders: [], selected: null, pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  loading: false, error: null
};

export const OrdersStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(OrdersApiService)) => {
    let version = 0;
    return {
    async loadOrders(page = 1) {
      const requestVersion = version;
      patchState(store, { loading: true, error: null });
      try {
        const response = await api.getOrders(page);
        if (requestVersion === version)
          patchState(store, { orders: response.data, pagination: response.pagination, loading: false });
      } catch (error) { if (requestVersion === version) patchState(store, { loading: false,
        error: toApiProblem(error, 'No hemos podido cargar tus pedidos.').message }); }
    },
    async loadOrder(orderId: string) {
      const requestVersion = version;
      patchState(store, { loading: true, error: null, selected: null });
      try { const response = await api.getOrder(orderId);
        if (requestVersion === version) patchState(store, { selected: response.data, loading: false }); }
      catch (error) { if (requestVersion === version) patchState(store, { loading: false,
        error: toApiProblem(error, 'No hemos podido cargar el pedido.').message }); }
    },
    reset() { version++; patchState(store, initialState); }
  }; })
);
