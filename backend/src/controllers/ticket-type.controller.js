import { crudController } from './crud.controller.js';
import { ticketTypeService } from '../services/ticket-type.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pagination } from '../utils/pagination.js';
export const ticketTypeController = {
  ...crudController(ticketTypeService),
  listByEvent: asyncHandler(async (req, res) => {
    const query = req.validated.query;
    const result = await ticketTypeService.listByEvent(req.params.eventId, query, req.user);
    res.json({ data: result.rows, pagination: pagination(query.page, query.limit, result.total) });
  }),
  createForEvent: asyncHandler(async (req, res) => res.status(201).json({ data: await ticketTypeService.createForEvent(req.params.eventId, req.validated.body) }))
};
