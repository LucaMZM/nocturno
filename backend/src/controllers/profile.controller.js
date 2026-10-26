import { profileService } from '../services/profile.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const profileController = {
  getMine: asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ data: await profileService.getMine(req.user.id) });
  }),
  updateMine: asyncHandler(async (req, res) =>
    res.json({ data: await profileService.updateMine(req.user.id, req.validated.body) })),
};
