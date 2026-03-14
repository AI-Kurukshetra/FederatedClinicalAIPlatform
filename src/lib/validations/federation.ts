import { z } from 'zod';

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createFederatedNodeSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(2).max(180),
  slug: z.string().min(2).max(180).regex(slugRegex, 'slug must be lowercase kebab-case'),
  region: z.string().min(2).max(120),
  endpointUrl: z.string().url().optional(),
  status: z.enum(['online', 'degraded', 'offline', 'maintenance']).default('online'),
  capabilities: z.record(z.string(), z.unknown()).optional(),
});

export const createIngestionJobSchema = z.object({
  orgId: z.string().uuid(),
  nodeId: z.string().uuid().optional(),
  sourceName: z.string().min(2).max(180),
  sourceType: z.enum(['ehr', 'pacs', 'lab', 'notes', 'claims', 'fhir', 'other']),
  status: z.enum(['queued', 'running', 'completed', 'failed']).default('queued'),
  recordsProcessed: z.number().int().nonnegative().optional(),
  errorMessage: z.string().max(4000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
});

export const createDataQualityMetricSchema = z.object({
  orgId: z.string().uuid(),
  sourceName: z.string().min(2).max(180),
  metricName: z.string().min(2).max(180),
  metricValue: z.number().min(0).max(100),
  status: z.enum(['good', 'warning', 'critical']).default('good'),
  details: z.record(z.string(), z.unknown()).optional(),
  measuredAt: z.string().datetime().optional(),
});
