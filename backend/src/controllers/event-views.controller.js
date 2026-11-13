import { eventViewsService } from '../services/event-views.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
export const eventViewsController = {
  record: asyncHandler(async (req, res) => {
    await eventViewsService.record(req.validated.params.slug, {
      ip: req.ip, agent: req.get('user-agent'), purpose: req.get('sec-purpose') ?? req.get('purpose'),
    });
    res.sendStatus(204);
  }),
  ranking: asyncHandler(async (req, res) => res.json({
    data: await eventViewsService.ranking(req.user, req.validated.query.days),
  })),
};
