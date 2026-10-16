import { toCamel } from '../utils/mapping.js';
export function mapTicketType(row) {
  const ticket = toCamel(row);
  if (ticket) ticket.price = Number(ticket.price);
  return ticket;
}
