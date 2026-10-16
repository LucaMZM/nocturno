import { crudController } from './crud.controller.js';
import { venueService } from '../services/venue.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
export const venueController = {
  ...crudController(venueService),
  publicProfile: asyncHandler(async (req, res) =>
    res.json({ data: await venueService.getPublicProfile(req.params.slug) }))
};
