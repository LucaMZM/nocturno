import { dashboardService } from '../services/dashboard.service.js';
import { pagination } from '../utils/pagination.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const dashboardController = {
  getSummary: asyncHandler(async (req, res) =>
    res.json({ data: await dashboardService.getSummary(req.user) })),
  listTopEvents: asyncHandler(async (req, res) =>
    res.json({ data: await dashboardService.listTopEvents(req.user, req.validated.query.sort) })),
  listEvents: asyncHandler(async (req, res) => {
    const query = req.validated.query;
    const events = await dashboardService.listEvents(req.user, query);
    res.json({ data: events.rows, pagination: pagination(query.page, query.limit, events.total) });
  }),
  listSales: asyncHandler(async (req, res) => {
    const query = req.validated.query;
    const sales = await dashboardService.listSales(req.user, query);
    res.json({ data: sales.rows, pagination: pagination(query.page, query.limit, sales.total) });
  })
};
