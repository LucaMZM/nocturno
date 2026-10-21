import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { yomoganService } from '../services/yomogan.service.js';
export const yomoganController = {
  config: (_req, res) => res.json({ data: { avatarUrl: env.YOMOGAN_AVATAR_PATH ?? null } }),
  chat: asyncHandler(async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store');
      res.json({ data: await yomoganService.chat(req.validated.body.messages) });
    } finally {
      req.releaseYomoganSlot?.();
    }
  }),
};
