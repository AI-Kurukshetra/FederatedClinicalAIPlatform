import { z } from 'zod';

export const createStudySchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(3).max(180),
  description: z.string().max(2000).optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']).default('draft'),
});

export const updateStudySchema = z.object({
  name: z.string().min(3).max(180).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']).optional(),
});

export const inviteStudyMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['owner', 'editor', 'viewer']).default('viewer'),
});
