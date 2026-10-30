import { env } from '../config/env.js';
import { getPool } from '../config/db.js';
import { paymentRepository } from '../repositories/payment.repository.js';
import { orderRepository } from '../repositories/order.repository.js';
import { paymentService } from './payment.service.js';
import { stripeApiService } from './stripe-api.service.js';
import { AppError } from '../utils/AppError.js';

export function moneyToCents(value) {
  const text = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text))
    throw new AppError(422, 'INVALID_PRICE', 'Invalid ticket price');
  const [whole, fraction = ''] = text.split('.');
  return Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')));
}

function checkTicketAvailability(ticket, previousQuantity) {
  const now = new Date();
  if (!ticket.active || !ticket.event_active || ticket.event_deleted_at ||
      ticket.event_status !== 'PUBLISHED' || new Date(ticket.event_ends_at) <= now)
    throw new AppError(409, 'EVENT_UNAVAILABLE', 'An event is no longer available');
  if (ticket.sales_start && ticket.sales_start > now)
    throw new AppError(409, 'SALES_NOT_STARTED', 'Ticket sales have not started');
  if (ticket.sales_end && ticket.sales_end <= now)
    throw new AppError(409, 'SALES_ENDED', 'Ticket sales have ended');
  if (ticket.requested > ticket.stock - ticket.sold - ticket.reserved)
    throw new AppError(409, 'OUT_OF_STOCK', 'Not enough tickets remain');
  if (ticket.max_per_user && ticket.requested + previousQuantity > ticket.max_per_user)
    throw new AppError(409, 'TICKET_LIMIT', 'Quantity exceeds the per-user limit');
}

export const checkoutService = {
  async createOrderFromCart(userId, idempotencyKey) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const cartId = await orderRepository.lockCart(client, userId);
      if (!cartId) throw new AppError(409, 'CART_EMPTY', 'Add tickets to the cart first');
      const existing = await orderRepository.findByIdempotencyKey(client, userId, idempotencyKey);
      if (existing) {
        await client.query('COMMIT');
        return existing.id;
      }
      const tickets = await orderRepository.lockCartTickets(client, cartId);
      if (!tickets.length) throw new AppError(409, 'CART_EMPTY', 'Add tickets to the cart first');
      if (tickets.length > 50) throw new AppError(409, 'CART_LIMIT', 'Too many ticket types in cart');
      const previous = await orderRepository.countCommittedTickets(
        client, userId, tickets.map((ticket) => ticket.ticket_type_id));
      let totalCents = 0;
      for (const ticket of tickets) {
        checkTicketAvailability(ticket, previous.get(ticket.ticket_type_id) ?? 0);
        totalCents += moneyToCents(ticket.price) * ticket.requested;
      }
      if (totalCents > 99_999_999 || (totalCents > 0 && totalCents < 50))
        throw new AppError(422, 'PAYMENT_AMOUNT_INVALID', 'Order amount is outside payment limits');
      if (totalCents > 0) stripeApiService.requireConfiguration();
      const order = await orderRepository.createOrder(client, {
        userId, key: idempotencyKey, totalCents,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      });
      for (const ticket of tickets) {
        await orderRepository.addOrderItem(client, order.id, ticket, moneyToCents(ticket.price));
        await orderRepository.reserveStock(client, ticket.ticket_type_id, ticket.requested);
      }
      if (totalCents === 0) await paymentService.fulfillFreeOrder(client, order.id);
      else await orderRepository.createPendingPayment(client, order.id, totalCents);
      await client.query('COMMIT');
      return order.id;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  },
  async startCheckout(userId, idempotencyKey) {
    await checkoutService.expireStaleOrders();
    const orderId = await checkoutService.createOrderFromCart(userId, idempotencyKey);
    // Keep expiry and concurrent retries out until the provider ID is persisted.
    // Network I/O is bounded by the Stripe adapter's timeout; stock locks are not held.
    const client = await getPool().connect();
    let intent;
    try {
      await client.query('BEGIN');
      await paymentRepository.lockOrder(client, orderId);
      const order = await orderRepository.getOrder(orderId, userId, client);
      if (order.status === 'PAID' || order.status === 'REFUNDED') {
        await client.query('COMMIT');
        return { order, clientSecret: null };
      }
      if (order.status !== 'AWAITING_PAYMENT' || new Date(order.expiresAt) <= new Date())
        throw new AppError(409, 'ORDER_EXPIRED', 'Order expired; start checkout again');
      intent = order.providerPaymentId
        ? await stripeApiService.retrievePaymentIntent(order.providerPaymentId)
        : await stripeApiService.createPaymentIntent(order);
      if (!['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'succeeded', 'canceled'].includes(intent.status) ||
          (!['processing', 'succeeded', 'canceled'].includes(intent.status) && typeof intent.client_secret !== 'string') ||
          !intent.id || intent.amount !== order.totalCents || intent.currency !== order.currency.toLowerCase() ||
          intent.metadata?.order_id !== order.id || (env.NODE_ENV !== 'production' && intent.livemode === true) ||
          (order.providerPaymentId && intent.id !== order.providerPaymentId))
        throw new AppError(502, 'INVALID_PAYMENT_PROVIDER_RESPONSE', 'Payment provider returned an invalid payment');
      if (!order.providerPaymentId) await orderRepository.setProviderPaymentId(order.id, intent.id, client);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
    if (intent.status === 'succeeded') await paymentService.confirmPaymentIntent(intent);
    if (intent.status === 'canceled')
      throw new AppError(409, 'ORDER_EXPIRED', 'Payment was cancelled; start checkout again');
    const order = await orderRepository.getOrder(orderId, userId);
    return { order, clientSecret: order.status === 'AWAITING_PAYMENT' && intent.status !== 'processing'
      ? intent.client_secret : null };
  },
  async expireStaleOrders() {
    for (const orderId of await orderRepository.findExpiredOrderIds()) {
      const order = await orderRepository.getOrder(orderId);
      if (!order || order.status !== 'AWAITING_PAYMENT') continue;
      if (order.providerPaymentId) {
        try {
          let intent = await stripeApiService.retrievePaymentIntent(order.providerPaymentId);
          if (intent.status === 'succeeded') {
            await paymentService.confirmPaymentIntent(intent);
            continue;
          }
          if (intent.status !== 'canceled') {
            try { intent = await stripeApiService.cancelPaymentIntent(order.providerPaymentId); }
            catch {
              // Success can race with cancellation. Reconcile before releasing any stock.
              intent = await stripeApiService.retrievePaymentIntent(order.providerPaymentId);
              if (intent.status === 'succeeded') await paymentService.confirmPaymentIntent(intent);
              continue;
            }
          }
          if (intent.id !== order.providerPaymentId || intent.status !== 'canceled') continue;
        } catch { continue; } // Uncertain provider state must retain the reservation.
      }
      await paymentService.releaseExpiredOrder(orderId, order.providerPaymentId);
    }
  }
};
