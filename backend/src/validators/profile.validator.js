import { z } from 'zod';
import { patch } from './common.js';

export const profilePatch = patch(z.object({
  displayName: z.string().trim().min(1).max(120),
  avatarUrl: z.url().max(2048).refine(value => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  }, 'Use an HTTPS image URL without credentials').nullable(),
}));
