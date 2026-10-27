import { getPool } from '../config/db.js';
import { cartRepository } from '../repositories/cart.repository.js';
import { AppError } from '../utils/AppError.js';

function validateSelection(ticket, quantity) {
  if (!ticket || !ticket.active || !ticket.event_active || ticket.event_deleted_at ||
      ticket.event_status !== 'PUBLISHED' ||
      new Date(ticket.event_ends_at) <= new Date())
    throw new AppError(404, 'TICKET_TYPE_NOT_FOUND', 'Ticket type is not available');
  if (ticket.sales_start && new Date(ticket.sales_start) > new Date())
    throw new AppError(409, 'SALES_NOT_STARTED', 'Ticket sales have not started');
  if (ticket.sales_end && new Date(ticket.sales_end) <= new Date())
    throw new AppError(409, 'SALES_ENDED', 'Ticket sales have ended');
  if (ticket.max_per_user && quantity > ticket.max_per_user)
    throw new AppError(409, 'TICKET_LIMIT', 'Quantity exceeds the per-user limit');
  if (quantity > ticket.quantity - ticket.sold - ticket.reserved)
    throw new AppError(409, 'OUT_OF_STOCK', 'Not enough tickets remain');
}

async function changeQuantity(userId, ticketTypeId, quantity, increment) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const cartId = await cartRepository.ensureCart(userId, client);
    await cartRepository.lockCart(client, cartId);
    const ticket = await cartRepository.getTicketForCart(client, ticketTypeId);
    const current = await cartRepository.getItemByTicketType(client, cartId, ticketTypeId);
    if (!increment && !current)
      throw new AppError(404, 'CART_ITEM_NOT_FOUND', 'Cart item not found');
    const nextQuantity = increment ? (current?.quantity ?? 0) + quantity : quantity;
    if (nextQuantity > 10) throw new AppError(409, 'TICKET_LIMIT', 'Maximum 10 tickets per type');
    validateSelection(ticket, nextQuantity);
    await cartRepository.setQuantity(client, cartId, ticketTypeId, nextQuantity);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
  return cartService.getCart(userId);
}

export const cartService = {
  async getCart(userId) {
    const cartId = await cartRepository.ensureCart(userId);
    const items = (await cartRepository.listItems(cartId)).map(item => {
      let unavailableReason = null;
      try {
        validateSelection({ active: item.active, event_active: item.eventActive,
          event_deleted_at: item.eventDeletedAt, event_status: item.eventStatus,
          event_ends_at: item.eventEndsAt, sales_start: item.salesStart, sales_end: item.salesEnd,
          max_per_user: item.maxPerUser, quantity: item.available, sold: 0, reserved: 0 }, item.quantity);
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        unavailableReason = error.code;
      }
      return { ...item, purchasable: unavailableReason === null, unavailableReason };
    });
    return {
      id: cartId,
      items,
      totalCents: items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)
    };
  },
  async addItem(userId, { ticketTypeId, quantity }) {
    return changeQuantity(userId, ticketTypeId, quantity, true);
  },
  async updateItem(userId, itemId, quantity) {
    const cartId = await cartRepository.ensureCart(userId);
    const item = await cartRepository.getItem(getPool(), cartId, itemId);
    if (!item) throw new AppError(404, 'CART_ITEM_NOT_FOUND', 'Cart item not found');
    return changeQuantity(userId, item.ticket_type_id, quantity, false);
  },
  async removeItem(userId, itemId) {
    const cartId = await cartRepository.ensureCart(userId);
    if (!await cartRepository.removeItem(cartId, itemId))
      throw new AppError(404, 'CART_ITEM_NOT_FOUND', 'Cart item not found');
    return cartService.getCart(userId);
  },
  async clear(userId) {
    const cartId = await cartRepository.ensureCart(userId);
    await cartRepository.clear(cartId);
    return cartService.getCart(userId);
  }
};
