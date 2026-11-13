import { z } from 'zod';
import { patch } from './common.js';
export const profilePatch = patch(z.object({
  displayName: z.string().trim().min(1).max(120),
}));
