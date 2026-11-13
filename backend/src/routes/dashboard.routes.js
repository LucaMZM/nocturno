import { z } from 'zod';
import { eventViewsController } from '../controllers/event-views.controller.js';
import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import { validate, listQuery } from '../validators/common.js';
import { dashboardListQuery, dashboardSalesQuery, dashboardTopQuery } from '../validators/dashboard.validator.js';

export const dashboardRoutes = Router();
dashboardRoutes.use(requireAuth, requireRole('ADMIN', 'PROMOTER'));
dashboardRoutes.get('/', dashboardController.getSummary);
dashboardRoutes.get('/top-events', validate(dashboardTopQuery, 'query'), dashboardController.listTopEvents);
dashboardRoutes.get('/events', validate(dashboardListQuery, 'query'), dashboardController.listEvents);
dashboardRoutes.get('/sales', validate(dashboardSalesQuery, 'query'), dashboardController.listSales);

dashboardRoutes.get('/most-visited', validate(z.object({days:z.coerce.number().refine(value => [7,30].includes(value)).default(7)}).strict(), 'query'), eventViewsController.ranking);
