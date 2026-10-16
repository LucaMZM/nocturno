import { favoriteService } from '../services/favorite.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pagination } from '../utils/pagination.js';
export const favoriteController = {
  list: asyncHandler(async (req, res) => {
    const query = req.validated.query;
    const result = await favoriteService.list(req.params.userId, query);
    res.json({ data: result.rows, pagination: pagination(query.page, query.limit, result.total) });
  }),
  add: asyncHandler(async (req, res) => res.status(201).json({ data: await favoriteService.add(req.params.userId, req.params.eventId) })),
  remove: asyncHandler(async (req, res) => { await favoriteService.remove(req.params.userId, req.params.eventId); res.status(204).end(); })
};

export const myFavoriteController = {
  list: asyncHandler(async (req, res) => {
    const query = req.validated.query;
    const result = await favoriteService.list(req.user.id, query);
    res.json({ data: result.rows, pagination: pagination(query.page, query.limit, result.total) });
  }),
  add: asyncHandler(async (req, res) =>
    res.status(201).json({ data: await favoriteService.add(req.user.id, req.params.eventId) })),
  remove: asyncHandler(async (req, res) => {
    await favoriteService.remove(req.user.id, req.params.eventId);
    res.status(204).end();
  })
};
