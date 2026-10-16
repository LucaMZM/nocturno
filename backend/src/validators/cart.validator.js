import { z } from 'zod';

export const cartItemCreate = z.object({
  ticketTypeId: z.uuid(),
  quantity: z.number().int().min(1).max(10)
}).strict();

export const cartItemUpdate = z.object({
  quantity: z.number().int().min(1).max(10)
}).strict();
