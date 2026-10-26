import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validate } from '../validators/common.js';
import { profilePatch } from '../validators/profile.validator.js';
import { profileController } from '../controllers/profile.controller.js';

export const profileRoutes = Router();
profileRoutes.get('/me', requireAuth, profileController.getMine);
profileRoutes.patch('/me', requireAuth, validate(profilePatch), profileController.updateMine);
