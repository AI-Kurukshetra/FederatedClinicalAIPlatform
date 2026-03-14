import { z } from 'zod';

export const createOrgSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase kebab-case'),
});

export const inviteMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'researcher', 'analyst', 'member']).default('member'),
  status: z.enum(['active', 'invited', 'disabled']).default('active'),
});
