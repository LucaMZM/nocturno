import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { Cart } from '../../../core/models/commerce.model';
import { toApiProblem } from '../../../shared/utils/api-error';
import { CartApiService } from '../services/cart-api.service';

interface CartState {
  cart: Cart | null;
  loading: boolean;
  pending: boolean;
  error: string | null;
  message: string | null;
}
const initialState: CartState = { cart: null, loading: false, pending: false, error: null, message: null };

export const CartStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ cart }) => ({ itemCount: computed(() => cart()?.items.reduce(
    (sum, item) => sum + item.quantity, 0) ?? 0) })),
  withMethods((store, api = inject(CartApiService)) => {
    let version = 0;
    async function change(operation: () => Promise<{ data: Cart }>, successMessage?: string) {
      if (store.pending()) return false;
      const requestVersion = version;
      patchState(store, { pending: true, error: null, message: null });
      try {
        const response = await operation();
        if (requestVersion !== version) return false;
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('nocturno_checkout_key');
        patchState(store, { cart: response.data, pending: false, message: successMessage ?? null });
        return true;
      } catch (error) {
        if (requestVersion !== version) return false;
        patchState(store, { pending: false,
          error: toApiProblem(error, 'No hemos podido actualizar el carrito.').message });
        return false;
      }
    }
    return {
      async load() {
        if (store.loading()) return;
        const requestVersion = version;
        patchState(store, { loading: true, error: null });
        try { const response = await api.getCart();
          if (requestVersion === version) patchState(store, { cart: response.data, loading: false }); }
        catch (error) { if (requestVersion === version) patchState(store, { loading: false,
          error: toApiProblem(error, 'No hemos podido cargar el carrito.').message }); }
      },
      addItem: (ticketTypeId: string, quantity = 1) =>
        change(() => api.addItem(ticketTypeId, quantity), 'Entrada añadida al carrito.'),
      updateItem: (itemId: string, quantity: number) =>
        change(() => api.updateItem(itemId, quantity)),
      removeItem: (itemId: string) => change(() => api.removeItem(itemId)),
      clear: () => change(() => api.clear()),
      clearMessage() { patchState(store, { message: null, error: null }); },
      reset() {
        version++;
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('nocturno_checkout_key');
        patchState(store, initialState);
      }
    };
  })
);
