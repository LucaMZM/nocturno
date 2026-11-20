import { shopService } from '../services/shop.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pagination } from '../utils/pagination.js';

const collection = (method) => asyncHandler(async (_req, res) =>
  res.json({ data: await shopService[method]() }));
export const shopController = {
  categories: collection('categories'),
  hosts: collection('hosts'),
  locations: collection('locations'),
  events: asyncHandler(async (req, res) => {
    const filters = req.validated.query;
    const result = await shopService.events(filters);
    res.json({ data: result.events, pagination: pagination(filters.page, filters.limit, result.total) });
  }),
  detail: asyncHandler(async (req, res) =>
    res.json({ data: await shopService.detail(req.validated.params.slug) })),
  variants: asyncHandler(async (req, res) =>
    res.json({ data: await shopService.variants(req.validated.params.slug) })),
};
