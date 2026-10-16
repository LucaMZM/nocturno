import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { checkoutController } from '../controllers/checkout.controller.js';
import { validate, validateId, orderListQuery } from '../validators/common.js';

export const checkoutRoutes = Router();
checkoutRoutes.use(requireAuth);
checkoutRoutes.post('/', checkoutController.startCheckout);

export const orderRoutes = Router();
orderRoutes.use(requireAuth);
orderRoutes.get('/', validate(orderListQuery, 'query'), checkoutController.listOrders);
orderRoutes.get('/:id', validateId(), checkoutController.getOrder);
