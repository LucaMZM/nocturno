import { asyncHandler } from '../utils/asyncHandler.js';
import { pagination } from '../utils/pagination.js';
export function crudController(service) {
  return {
    list: asyncHandler(async (req, res) => {
      const query = req.validated.query;
      const result = await service.list(query);
      res.json({ data: result.rows, pagination: pagination(query.page, query.limit, result.total) });
    }),
    get: asyncHandler(async (req, res) => res.json({ data: await service.get(req.params.id) })),
    create: asyncHandler(async (req, res) => res.status(201).json({ data: await service.create(req.validated.body) })),
    update: asyncHandler(async (req, res) => res.json({ data: await service.update(req.params.id, req.validated.body) })),
    remove: asyncHandler(async (req, res) => { await service.remove(req.params.id); res.status(204).end(); })
  };
}
