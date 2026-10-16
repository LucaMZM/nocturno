import { Router } from 'express';
import { z } from 'zod';
import { ticketController } from '../controllers/ticket.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import { validate, validateId, listQuery, adminTicketListQuery } from '../validators/common.js';

export const ticketRoutes = Router();
ticketRoutes.use(requireAuth);
ticketRoutes.get('/admin/all', requireRole('ADMIN'), validate(adminTicketListQuery, 'query'), ticketController.listAll);
ticketRoutes.get('/', validate(listQuery, 'query'), ticketController.listMine);
ticketRoutes.get('/:id', validateId(), ticketController.getMine);
ticketRoutes.post('/:code/check-in', requireRole('ADMIN', 'PROMOTER'),
  validateId('code'), validate(z.object({ eventId: z.uuid() }).strict()), ticketController.checkIn);
