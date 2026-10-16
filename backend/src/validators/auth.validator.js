import { z } from 'zod';

const email = z.email().max(320).transform((value) => value.toLowerCase());
const password = z.string().min(10).max(128);

export const registerInput = z.object({
  email,
  password,
  displayName: z.string().trim().min(1).max(120)
}).strict();

export const loginInput = z.object({ email, password: z.string().min(1) }).strict();
export const profilePatch = z.object({ displayName: z.string().trim().min(1).max(120) }).strict();
