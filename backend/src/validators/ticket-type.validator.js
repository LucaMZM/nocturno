import { z } from 'zod';
import { patch } from './common.js';
const date = z.iso.datetime({ offset: true });
const price = z.number().min(0).max(99999999.99).refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, 'price must have at most two decimal places');
export const ticketTypeCreate = z.object({
  name: z.string().trim().min(1).max(120), price, quantity: z.number().int().min(0),
  salesStart: date.nullable().optional(), salesEnd: date.nullable().optional(),
  maxPerUser: z.number().int().positive().nullable().optional(), benefits: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
  active: z.boolean().default(true)
}).strict();
export const ticketTypePatch = patch(ticketTypeCreate);
