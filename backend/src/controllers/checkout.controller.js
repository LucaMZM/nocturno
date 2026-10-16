import { z } from 'zod';
import { checkoutService } from '../services/checkout.service.js';
import { orderRepository } from '../repositories/order.repository.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { pagination } from '../utils/pagination.js';

export const checkoutController = {
  startCheckout: asyncHandler(async (req, res) => {
    const key = req.get('idempotency-key');
    if (!z.uuid().safeParse(key).success)
      throw new AppError(400, 'INVALID_IDEMPOTENCY_KEY', 'A UUID Idempotency-Key is required');
    res.json({ data: await checkoutService.startCheckout(req.user.id, key) });
  }),
  listOrders: asyncHandler(async (req, res) => {
    const query = req.validated.query;
    const orders = await orderRepository.listOrders(req.user.role === 'ADMIN' ? null : req.user.id, query);
    res.json({ data: orders.rows, pagination: pagination(query.page, query.limit, orders.total) });
  }),
  getOrder: asyncHandler(async (req, res) => {
    const order = await orderRepository.getOrder(req.params.id, req.user.role === 'ADMIN' ? null : req.user.id);
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
    res.json({ data: order });
  })
};
