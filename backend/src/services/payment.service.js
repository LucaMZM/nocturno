import { createHmac, timingSafeEqual } from 'node:crypto';
import { getPool } from '../config/db.js';
import { env } from '../config/env.js';
import { paymentRepository } from '../repositories/payment.repository.js';
import { stripeApiService } from './stripe-api.service.js';
import { AppError } from '../utils/AppError.js';

export function verifyStripeWebhook(rawBody, signatureHeader, secret = env.STRIPE_WEBHOOK_SECRET) {
  if (!secret || !signatureHeader || !Buffer.isBuffer(rawBody))
    throw new AppError(400, 'INVALID_STRIPE_SIGNATURE', 'Invalid webhook signature');
  const parts = signatureHeader.split(',').map((part) => part.trim().split('='));
  const timestamp = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || !/^\d+$/.test(timestamp) || !signatures.length ||
      Math.abs(Date.now() / 1000 - Number(timestamp)) > 300)
    throw new AppError(400, 'INVALID_STRIPE_SIGNATURE', 'Invalid webhook signature');
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody.toString('utf8')}`).digest();
  const valid = signatures.some((value) => {
    if (!/^[0-9a-f]{64}$/i.test(value)) return false;
    return timingSafeEqual(Buffer.from(value, 'hex'), expected);
  });
  if (!valid) throw new AppError(400, 'INVALID_STRIPE_SIGNATURE', 'Invalid webhook signature');
  try { return JSON.parse(rawBody.toString('utf8')); }
  catch { throw new AppError(400, 'INVALID_WEBHOOK_BODY', 'Invalid webhook body'); }
}

export const paymentService = {
  async requestFullRefund(paymentId) {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
    if (payment.status === 'REFUNDED' && payment.order_status === 'REFUNDED')
      return { status: 'REFUNDED', providerRefundId: payment.provider_refund_id };
    if (payment.status !== 'PAID' || payment.order_status !== 'PAID' || !payment.provider_payment_id)
      throw new AppError(409, 'PAYMENT_NOT_REFUNDABLE', 'Payment cannot be refunded');
    if (payment.provider_payment_id.startsWith('pi_demo_'))
      throw new AppError(409, 'DEMO_PAYMENT_NOT_REFUNDABLE', 'Seed payment is not a real Stripe charge');
    if (payment.refund_requested_at)
      return { status: 'PENDING', providerRefundId: payment.provider_refund_id };
    const refund = await stripeApiService.createRefund(payment.provider_payment_id, payment.id);
    if (!refund.id || refund.payment_intent !== payment.provider_payment_id)
      throw new AppError(502, 'INVALID_REFUND_RESPONSE', 'Payment provider returned an invalid refund');
    await paymentRepository.markRefundRequested(payment.id, refund.id);
    return { status: 'PENDING', providerRefundId: refund.id };
  },
  async confirmPaymentIntent({ id, amount_received: received, currency }) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const found = await paymentRepository.findPaymentByProviderId(client, id);
      if (!found) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
      const order = await paymentRepository.lockOrder(client, found.order_id);
      const payment = await paymentRepository.lockPaymentByProviderId(client, id);
      if ((payment.status === 'PAID' && order.status === 'PAID') ||
          (payment.status === 'REFUNDED' && order.status === 'REFUNDED')) {
        await client.query('COMMIT');
        return;
      }
      if (order.status !== 'AWAITING_PAYMENT')
        throw new AppError(409, 'ORDER_NOT_PAYABLE', 'Order cannot be paid');
      if (Number(payment.amount_cents) !== received || payment.currency.toLowerCase() !== currency)
        throw new AppError(409, 'PAYMENT_AMOUNT_MISMATCH', 'Payment amount mismatch');
      const items = await paymentRepository.getOrderItems(client, order.id);
      const stock = await paymentRepository.lockTicketStock(client, items.map((item) => item.ticket_type_id));
      if (stock.length !== items.length ||
          items.some((item) => Number(stock.find((row) => row.id === item.ticket_type_id)?.reserved) < item.quantity))
        throw new AppError(409, 'STOCK_RESERVATION_MISSING', 'Reserved stock is missing');
      await paymentRepository.fulfillOrder(client, order, items, payment.id);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  },
  async failPaymentIntent({ id }) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const found = await paymentRepository.findPaymentByProviderId(client, id);
      if (!found) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
      const order = await paymentRepository.lockOrder(client, found.order_id);
      const payment = await paymentRepository.lockPaymentByProviderId(client, id);
      if (order.status === 'AWAITING_PAYMENT' && payment.status === 'PENDING')
        await client.query("UPDATE payments SET status = 'FAILED' WHERE id = $1", [payment.id]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  },
  async refundCharge({ payment_intent: paymentIntentId, amount, amount_refunded: amountRefunded, currency }) {
    if (!paymentIntentId || amountRefunded !== amount) return; // The v1 order model represents full refunds only.
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const found = await paymentRepository.findPaymentByProviderId(client, paymentIntentId);
      if (!found) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
      const order = await paymentRepository.lockOrder(client, found.order_id);
      const payment = await paymentRepository.lockPaymentByProviderId(client, paymentIntentId);
      if (order.status === 'REFUNDED' && payment.status === 'REFUNDED') {
        await client.query('COMMIT');
        return;
      }
      if (order.status !== 'PAID' || payment.status !== 'PAID')
        throw new AppError(409, 'ORDER_NOT_REFUNDABLE', 'Order is not paid');
      if (Number(payment.amount_cents) !== amountRefunded || payment.currency.toLowerCase() !== currency)
        throw new AppError(409, 'REFUND_AMOUNT_MISMATCH', 'Refund amount mismatch');
      const items = await paymentRepository.getOrderItems(client, order.id);
      await paymentRepository.lockTicketStock(client, items.map((item) => item.ticket_type_id));
      for (const item of items) {
        await client.query('UPDATE ticket_types SET sold = sold - $2 WHERE id = $1',
          [item.ticket_type_id, item.quantity]);
      }
      await client.query("UPDATE tickets SET status = 'REFUNDED' WHERE order_item_id = ANY($1::uuid[]) AND status <> 'REFUNDED'",
        [items.map((item) => item.id)]);
      await client.query("UPDATE payments SET status = 'REFUNDED' WHERE id = $1", [payment.id]);
      await client.query("UPDATE orders SET status = 'REFUNDED' WHERE id = $1", [order.id]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  },
  async fulfillFreeOrder(client, orderId) {
    const order = await paymentRepository.lockOrder(client, orderId);
    const items = await paymentRepository.getOrderItems(client, orderId);
    await paymentRepository.fulfillOrder(client, order, items);
  },
  async releaseExpiredOrder(orderId, canceledPaymentIntentId = null) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const order = await paymentRepository.lockOrder(client, orderId);
      if (!order || order.status !== 'AWAITING_PAYMENT' || order.expires_at > new Date()) {
        await client.query('COMMIT');
        return false;
      }
      const { rows } = await client.query(
        'SELECT provider_payment_id FROM payments WHERE order_id = $1 FOR UPDATE', [orderId]);
      if (rows[0]?.provider_payment_id && rows[0].provider_payment_id !== canceledPaymentIntentId) {
        await client.query('COMMIT');
        return false;
      }
      const items = await paymentRepository.getOrderItems(client, orderId);
      await paymentRepository.lockTicketStock(client, items.map((item) => item.ticket_type_id));
      await paymentRepository.expireOrder(client, order, items);
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  },
  listPayments: paymentRepository.listPayments
};
