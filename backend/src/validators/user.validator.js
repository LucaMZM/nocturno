import { z } from 'zod';
import { patch } from './common.js';
import { registerInput } from './auth.validator.js';
export const userCreate = registerInput.extend({
  role: z.enum(['USER', 'PROMOTER', 'ADMIN']).default('USER'),
  promoterId: z.uuid().nullable().optional()
});
export const userPatch = patch(z.object({
  email: z.email().max(320).transform((value) => value.toLowerCase()),
  displayName: z.string().trim().min(1).max(120),
  role: z.enum(['USER', 'PROMOTER', 'ADMIN']),
  isActive: z.boolean(),
  promoterId: z.uuid().nullable()
}));
