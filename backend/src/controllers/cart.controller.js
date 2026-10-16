import { cartService } from '../services/cart.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const cartController = {
  getCart: asyncHandler(async (req, res) => res.json({ data: await cartService.getCart(req.user.id) })),
  addItem: asyncHandler(async (req, res) =>
    res.status(201).json({ data: await cartService.addItem(req.user.id, req.validated.body) })),
  updateItem: asyncHandler(async (req, res) =>
    res.json({ data: await cartService.updateItem(req.user.id, req.params.id, req.validated.body.quantity) })),
  removeItem: asyncHandler(async (req, res) =>
    res.json({ data: await cartService.removeItem(req.user.id, req.params.id) })),
  clear: asyncHandler(async (req, res) => res.json({ data: await cartService.clear(req.user.id) }))
};
