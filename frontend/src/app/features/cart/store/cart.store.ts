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
    (sum, item) => sum + item.quantity, 0) ?? 0),
    canCheckout: computed(() => !!cart()?.items.length && cart()!.items.every(item => item.purchasable))
  })),
  withMethods((store, api = inject(CartApiService)) => {
    let version = 0;
    async function change(operation: () => Promise<{ data: Cart }>, successMessage?: string) {
      if (store.pending()) return false;
      const requestVersion = ++version;
      patchState(store, { loading: false, pending: true, error: null, message: null });
      try {
        const response = await operation();
        if (requestVersion !== version) return false;
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('nocturno_checkout_key');
          sessionStorage.removeItem('nocturno_checkout_user');
        }
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
      async load(force = false) {
        if (store.loading() || store.pending() || (!force && store.cart())) return;
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
        change(() => api.updateItem(itemId, quantity), 'Cantidad actualizada.'),
      removeItem: (itemId: string) => change(() => api.removeItem(itemId), 'Entrada retirada del carrito.'),
      clear: () => change(() => api.clear(), 'Carrito vaciado.'),
      clearMessage() { patchState(store, { message: null, error: null }); },
      reset(preserveCheckoutKey = false) {
        version++;
        if (!preserveCheckoutKey && typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('nocturno_checkout_key');
          sessionStorage.removeItem('nocturno_checkout_user');
        }
        patchState(store, initialState);
      }
    };
  })
);
