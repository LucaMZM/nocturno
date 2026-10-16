import { Router } from 'express';
import { stripeController } from '../controllers/stripe.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import { validate, validateId, paymentListQuery } from '../validators/common.js';

export const paymentRoutes = Router();
paymentRoutes.use(requireAuth, requireRole('ADMIN'));
paymentRoutes.get('/', validate(paymentListQuery, 'query'), stripeController.listPayments);
paymentRoutes.post('/:id/refund', validateId(), stripeController.requestFullRefund);
