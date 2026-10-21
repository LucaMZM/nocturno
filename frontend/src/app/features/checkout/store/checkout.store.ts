import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { CheckoutSession } from '../../../core/models/commerce.model';
import { toApiProblem } from '../../../shared/utils/api-error';
import { CheckoutApiService, PaymentConfig } from '../services/checkout-api.service';

interface CheckoutState {
  config: PaymentConfig | null;
  session: CheckoutSession | null;
  loading: boolean;
  error: string | null;
}
const initialState: CheckoutState = { config: null, session: null, loading: false, error: null };

export const CheckoutStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(CheckoutApiService)) => ({
    async loadConfig() {
      patchState(store, { error: null });
      try { patchState(store, { config: (await api.getPaymentConfig()).data }); }
      catch (error) { patchState(store, { error: toApiProblem(error, 'No hemos podido consultar el estado del pago.').message }); }
    },
    async start(): Promise<boolean> {
      patchState(store, { loading: true, error: null });
      try {
        // Preserve one key for this cart until it changes, so a repeated click cannot
        // create a second order after a lost response.
        const idempotencyKey = sessionStorage.getItem('nocturno_checkout_key') ?? crypto.randomUUID();
        sessionStorage.setItem('nocturno_checkout_key', idempotencyKey);
        const session = (await api.startCheckout(idempotencyKey)).data;
        patchState(store, { session, loading: false });
        return true;
      } catch (error) {
        patchState(store, { loading: false,
          error: toApiProblem(error, 'No hemos podido iniciar el pago. Revisa el carrito.').message });
        return false;
      }
    },
    setError(message: string) { patchState(store, { error: message }); }
  }))
);
