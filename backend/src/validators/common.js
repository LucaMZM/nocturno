import { z } from 'zod';
import { AppError } from '../utils/AppError.js';

export const id = z.uuid();
export const publicSlug = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(220) }).strict();
export const optionalUrl = z.url().nullable().optional();
export const optionalText = z.string().trim().max(5000).nullable().optional();
export const patch = (schema) => z.object(Object.fromEntries(Object.entries(schema.shape).map(([key, field]) =>
  [key, (field instanceof z.ZodDefault ? field.removeDefault() : field).optional()]
))).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required');
export const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
};
export const listQuery = z.object(pageQuery).strict();
const adminSearch = z.string().trim().max(120).optional();
export const userListQuery = z.object({ ...pageQuery, search: adminSearch,
  role: z.enum(['USER', 'PROMOTER', 'ADMIN']).optional() }).strict();
export const orderListQuery = z.object({ ...pageQuery, search: adminSearch,
  status: z.enum(['AWAITING_PAYMENT', 'PAID', 'CANCELLED', 'EXPIRED', 'REFUNDED']).optional(),
  eventId: id.optional(), dateFrom: z.iso.datetime({ offset: true }).optional(),
  dateTo: z.iso.datetime({ offset: true }).optional() }).strict()
  .refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo,
    'dateFrom must be before dateTo');
export const paymentListQuery = z.object({ ...pageQuery, search: adminSearch,
  status: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']).optional(),
  dateFrom: z.iso.datetime({ offset: true }).optional(),
  dateTo: z.iso.datetime({ offset: true }).optional() }).strict();
export const adminTicketListQuery = z.object({ ...pageQuery, search: adminSearch,
  status: z.enum(['VALID', 'USED', 'CANCELLED', 'REFUNDED']).optional() }).strict();
export const attendeeListQuery = z.object({ ...pageQuery, search: adminSearch }).strict();

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(result.error);
    req.validated ??= {};
    req.validated[source] = result.data;
    next();
  };
}
export function validateId(name = 'id') {
  return (req, _res, next) => {
    const result = id.safeParse(req.params[name]);
    if (!result.success) return next(new AppError(400, 'INVALID_ID', `Invalid ${name}`));
    next();
  };
}
