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

export const createOrgInviteSchema = z.object({
  orgId: z.string().uuid(),
  email: z.string().trim().email(),
  role: z.enum(['admin', 'researcher', 'analyst', 'member']).default('member'),
});

export const redeemOrgInviteSchema = z.object({
  token: z.string().trim().min(16).max(200),
});

export const quickJoinOrganizationSchema = z.object({
  orgId: z.string().uuid(),
});
