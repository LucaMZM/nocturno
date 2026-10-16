import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authRateLimit, requireAuth, requireTrustedOrigin } from '../middlewares/auth.middleware.js';
import { validate } from '../validators/common.js';
import { loginInput, profilePatch, registerInput } from '../validators/auth.validator.js';

export const authRoutes = Router();
authRoutes.post('/register', requireTrustedOrigin, authRateLimit, validate(registerInput), authController.register);
authRoutes.post('/login', requireTrustedOrigin, authRateLimit, validate(loginInput), authController.login);
authRoutes.post('/refresh', requireTrustedOrigin, authController.refresh);
authRoutes.post('/logout', requireTrustedOrigin, authController.logout);
authRoutes.get('/me', requireAuth, authController.me);
authRoutes.patch('/me', requireAuth, validate(profilePatch), authController.updateProfile);
