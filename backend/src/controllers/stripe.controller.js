import { paymentService, verifyStripeWebhook } from '../services/payment.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pagination } from '../utils/pagination.js';

export const stripeController = {
  webhook: asyncHandler(async (req, res) => {
    const event = verifyStripeWebhook(req.body, req.get('stripe-signature'));
    if (event.type === 'payment_intent.succeeded')
      await paymentService.confirmPaymentIntent(event.data.object);
    if (event.type === 'payment_intent.payment_failed')
      await paymentService.failPaymentIntent(event.data.object);
    if (event.type === 'charge.refunded')
      await paymentService.refundCharge(event.data.object);
    res.json({ received: true });
  }),
  listPayments: asyncHandler(async (req, res) => {
    const query = req.validated.query;
    const payments = await paymentService.listPayments(query);
    res.json({ data: payments.rows, pagination: pagination(query.page, query.limit, payments.total) });
  }),
  requestFullRefund: asyncHandler(async (req, res) =>
    res.status(202).json({ data: await paymentService.requestFullRefund(req.params.id) }))
};
