import { getPool } from '../config/db.js';
import { ticketRepository } from '../repositories/ticket.repository.js';
import { AppError } from '../utils/AppError.js';

export const ticketService = {
  listAll: (query) => ticketRepository.listAll(query),
  listForUser: ticketRepository.listForUser,
  async getForUser(ticketId, userId) {
    const ticket = await ticketRepository.getForUser(ticketId, userId);
    if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket not found');
    return ticket;
  },
  listAttendees: ticketRepository.listAttendees,
  getCheckInOverview: ticketRepository.getCheckInOverview,
  async checkIn(code, eventId, actor) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const ticket = await ticketRepository.getForCheckIn(client, code);
      if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket not found');
      if (ticket.eventId !== eventId)
        throw new AppError(409, 'WRONG_EVENT', 'Ticket belongs to another event');
      if (actor.role !== 'ADMIN' && actor.promoterId !== ticket.promoterId)
        throw new AppError(403, 'FORBIDDEN', 'You cannot check in this event');
      if (ticket.status === 'USED')
        throw new AppError(409, 'TICKET_ALREADY_USED', 'Ticket was already checked in',
          { usedAt: ticket.usedAt });
      if (ticket.status === 'CANCELLED' || ticket.status === 'REFUNDED')
        throw new AppError(409, 'TICKET_CANCELLED', 'Ticket is cancelled');
      if (ticket.status !== 'VALID')
        throw new AppError(409, 'TICKET_NOT_VALID', 'Ticket is not valid for entry');
      const used = await ticketRepository.markUsed(client, ticket.id);
      await client.query('COMMIT');
      return { ...ticket, status: used.status, usedAt: used.usedAt };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
};
