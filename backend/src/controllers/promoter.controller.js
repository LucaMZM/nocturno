import { crudController } from './crud.controller.js';
import { promoterService } from '../services/promoter.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
export const promoterController = {
  ...crudController(promoterService),
  publicProfile: asyncHandler(async (req, res) =>
    res.json({ data: await promoterService.getPublicProfile(req.params.slug) }))
};
