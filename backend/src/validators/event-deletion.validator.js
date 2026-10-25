import { z } from 'zod';
export const eventDeletionInput = z.object({
  analysisToken: z.string().regex(/^[a-f0-9]{64}$/),
  operation: z.enum(['delete', 'archive']),
  requestId: z.uuid(),
}).strict();
