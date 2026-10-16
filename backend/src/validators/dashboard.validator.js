import { z } from 'zod';
import { pageQuery } from './common.js';
import { statuses } from './event.validator.js';

export const dashboardListQuery = z.object({
  ...pageQuery,
  search: z.string().trim().max(160).optional(),
  status: z.enum(statuses).optional(),
  deleted: z.enum(['exclude', 'only']).default('exclude'),
  active: z.enum(['all', 'true', 'false']).default('all'),
  promoterId: z.uuid().optional(), venueId: z.uuid().optional(),
  municipality: z.string().trim().min(1).max(120).optional(),
  dateFrom: z.iso.datetime({ offset: true }).optional(),
  dateTo: z.iso.datetime({ offset: true }).optional()
}).strict().refine((value) => value.deleted !== 'only' || value.active === 'all',
  'Deleted events cannot use an active filter')
  .refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo,
    'dateFrom must be before dateTo');
export const dashboardSalesQuery = z.object({ ...pageQuery, eventId: z.uuid().optional(),
  search: z.string().trim().min(1).max(160).optional() }).strict();
export const dashboardTopQuery = z.object({ sort: z.enum(['revenue', 'tickets', 'date']).default('revenue') }).strict();
