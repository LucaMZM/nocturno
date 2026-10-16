import { Router } from 'express';
import { cartController } from '../controllers/cart.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validate, validateId } from '../validators/common.js';
import { cartItemCreate, cartItemUpdate } from '../validators/cart.validator.js';

export const cartRoutes = Router();
cartRoutes.use(requireAuth);
cartRoutes.get('/', cartController.getCart);
cartRoutes.post('/items', validate(cartItemCreate), cartController.addItem);
cartRoutes.patch('/items/:id', validateId(), validate(cartItemUpdate), cartController.updateItem);
cartRoutes.delete('/items/:id', validateId(), cartController.removeItem);
cartRoutes.delete('/items', cartController.clear);
