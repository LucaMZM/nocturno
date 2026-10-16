import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

function secretKey() {
  const key = env.STRIPE_SECRET_KEY;
  if (!key || !env.STRIPE_PUBLISHABLE_KEY || !env.STRIPE_WEBHOOK_SECRET)
    throw new AppError(503, 'STRIPE_NOT_CONFIGURED', 'Payments are not configured');
  if (env.NODE_ENV !== 'production' && (!key.startsWith('sk_test_') ||
      !env.STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_')))
    throw new AppError(503, 'STRIPE_TEST_KEY_REQUIRED', 'Use Stripe test keys in development');
  return key;
}

async function stripeRequest(path, { method = 'GET', fields, idempotencyKey } = {}) {
  const key = secretKey();
  let response;
  try {
    response = await fetch(`https://api.stripe.com/v1${path}`, {
      method,
      headers: {
        authorization: `Bearer ${key}`,
        ...(fields ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {})
      },
      ...(fields ? { body: new URLSearchParams(fields) } : {})
    });
  } catch {
    throw new AppError(502, 'PAYMENT_PROVIDER_UNAVAILABLE', 'Payment provider is unavailable');
  }
  const body = await response.json();
  if (!response.ok)
    throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', 'Payment provider rejected the request');
  return body;
}

export const stripeApiService = {
  requireConfiguration: secretKey,
  createPaymentIntent(order) {
    return stripeRequest('/payment_intents', {
      method: 'POST',
      idempotencyKey: `nocturno-order-${order.id}`,
      fields: {
        amount: String(order.totalCents),
        currency: order.currency.toLowerCase(),
        'payment_method_types[]': 'card',
        'metadata[order_id]': order.id
      }
    });
  },
  retrievePaymentIntent(id) {
    return stripeRequest(`/payment_intents/${encodeURIComponent(id)}`);
  },
  cancelPaymentIntent(id) {
    return stripeRequest(`/payment_intents/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      idempotencyKey: `nocturno-cancel-${id}`,
      fields: { cancellation_reason: 'abandoned' }
    });
  },
  createRefund(paymentIntentId, paymentId) {
    return stripeRequest('/refunds', {
      method: 'POST',
      idempotencyKey: `nocturno-full-refund-${paymentId}`,
      fields: { payment_intent: paymentIntentId }
    });
  }
};
