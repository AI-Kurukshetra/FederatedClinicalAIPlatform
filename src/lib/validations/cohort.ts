import { z } from 'zod';

export const createCohortSchema = z.object({
  orgId: z.string().uuid(),
  studyId: z.string().uuid().nullable().optional(),
  name: z.string().min(3).max(180),
  description: z.string().max(2000).optional(),
});

export const createCohortVersionSchema = z.object({
  versionNo: z.number().int().positive(),
  definitionJson: z.record(z.string(), z.unknown()),
});

export const createCohortRunSchema = z.object({
  cohortVersionId: z.string().uuid().optional(),
});
