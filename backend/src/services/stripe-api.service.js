import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

function secretKey() {
  const key = env.STRIPE_SECRET_KEY;
  if (!key || !env.STRIPE_PUBLISHABLE_KEY || !env.STRIPE_WEBHOOK_SECRET)
    throw new AppError(503, 'STRIPE_NOT_CONFIGURED', 'Payments are not configured');
  if (!env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_') ||
      (env.NODE_ENV !== 'production' && (!key.startsWith('sk_test_') ||
      !env.STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_'))))
    throw new AppError(503, 'STRIPE_TEST_KEY_REQUIRED', 'Use Stripe test keys in development');
  return key;
}

async function stripeRequest(path, { method = 'GET', fields, idempotencyKey } = {}) {
  const key = secretKey();
  let response;
  try {
    response = await fetch(`https://api.stripe.com/v1${path}`, {
      method,
      signal: AbortSignal.timeout(15000),
      headers: {
        authorization: `Bearer ${key}`,
        'stripe-version': '2026-09-30.endive',
        ...(fields ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {})
      },
      ...(fields ? { body: new URLSearchParams(fields) } : {})
    });
  } catch {
    throw new AppError(502, 'PAYMENT_PROVIDER_UNAVAILABLE', 'Payment provider is unavailable');
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new AppError(502, 'INVALID_PAYMENT_PROVIDER_RESPONSE', 'Payment provider returned an invalid response');
  }
  if (!response.ok)
    throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', 'Payment provider rejected the request');
  return body;
}

export const stripeApiService = {
  requireConfiguration: secretKey,
  publicConfiguration() {
    let enabled = false;
    try { secretKey(); enabled = true; } catch { /* Never publish secret configuration. */ }
    const key = env.STRIPE_PUBLISHABLE_KEY;
    const publishableKey = key && /^pk_(test|live)_/.test(key) &&
      (env.NODE_ENV === 'production' || key.startsWith('pk_test_')) ? key : null;
    return { enabled: enabled && !!publishableKey, publishableKey,
      testMode: !!(publishableKey?.startsWith('pk_test_') && env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) };
  },
  createPaymentIntent(order) {
    return stripeRequest('/payment_intents', {
      method: 'POST',
      idempotencyKey: `nocturno-order-${order.id}`,
      fields: {
        amount: String(order.totalCents),
        currency: order.currency.toLowerCase(),
        'automatic_payment_methods[enabled]': 'true',
        'automatic_payment_methods[allow_redirects]': 'never',
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
