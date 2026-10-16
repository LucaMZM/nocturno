import { z } from 'zod';
import { optionalText, optionalUrl, patch } from './common.js';
export const promoterCreate = z.object({
  name: z.string().trim().min(1).max(160), description: optionalText,
  email: z.email().max(320).nullable().optional(), phone: z.string().trim().max(40).nullable().optional(), websiteUrl: optionalUrl
}).strict();
export const promoterPatch = patch(promoterCreate);
