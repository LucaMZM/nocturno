import { ticketService } from '../services/ticket.service.js';
import { pagination } from '../utils/pagination.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const ticketController = {
  listAll: asyncHandler(async (req, res) => {
    const query = req.validated.query;
    const tickets = await ticketService.listAll(query);
    res.json({ data: tickets.rows, pagination: pagination(query.page, query.limit, tickets.total) });
  }),
  listMine: asyncHandler(async (req, res) => {
    const query = req.validated.query;
    const tickets = await ticketService.listForUser(req.user.id, query);
    res.json({ data: tickets.rows, pagination: pagination(query.page, query.limit, tickets.total) });
  }),
  getMine: asyncHandler(async (req, res) =>
    res.json({ data: await ticketService.getForUser(req.params.id, req.user.id) })),
  listAttendees: asyncHandler(async (req, res) => {
    const query = req.validated.query;
    const attendees = await ticketService.listAttendees(req.params.eventId, query);
    res.json({ data: attendees.rows,
      pagination: pagination(query.page, query.limit, attendees.total) });
  }),
  getCheckInOverview: asyncHandler(async (req, res) =>
    res.json({ data: await ticketService.getCheckInOverview(req.params.eventId) })),
  checkIn: asyncHandler(async (req, res) =>
    res.json({ data: await ticketService.checkIn(req.params.code, req.validated.body.eventId, req.user) }))
};
