import { z } from 'zod';

export const profilePatch = z.object({
  displayName: z.string().trim().min(1).max(120),
}).strict();
