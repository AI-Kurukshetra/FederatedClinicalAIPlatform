import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { getPagination } from '@/lib/api/http';
import { createIngestionJobSchema } from '@/lib/validations/federation';
import { writeAuditLog } from '@/server/services/audit';

export async function GET(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const url = new URL(request.url);
  const orgId = url.searchParams.get('orgId');
  if (!orgId) return fail({ code: 'VALIDATION_ERROR', message: 'orgId query param is required.' }, 422);

  const status = url.searchParams.get('status');
  const sourceName = url.searchParams.get('sourceName');
  const { limit, offset } = getPagination(url.searchParams);

  let query = supabase
    .from('ingestion_jobs')
    .select('id, org_id, node_id, source_name, source_type, status, records_processed, error_message, metadata, started_at, finished_at, triggered_by, created_at, updated_at')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (sourceName) query = query.eq('source_name', sourceName);

  const { data, error } = await query;
  if (error) return fail({ code: 'INGESTION_JOBS_LIST_FAILED', message: error.message }, 400);
  return ok(data, { limit, offset });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const body = await request.json().catch(() => null);
  const parsed = createIngestionJobSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: 'VALIDATION_ERROR', message: 'Invalid ingestion job payload.', details: parsed.error.flatten() }, 422);
  }

  const payload = {
    org_id: parsed.data.orgId,
    node_id: parsed.data.nodeId ?? null,
    source_name: parsed.data.sourceName,
    source_type: parsed.data.sourceType,
    status: parsed.data.status,
    records_processed: parsed.data.recordsProcessed ?? null,
    error_message: parsed.data.errorMessage ?? null,
    metadata: parsed.data.metadata ?? {},
    started_at: parsed.data.startedAt ?? null,
    finished_at: parsed.data.finishedAt ?? null,
    triggered_by: user.id,
  };

  const { data, error } = await supabase
    .from('ingestion_jobs')
    .insert(payload)
    .select('id, org_id, node_id, source_name, source_type, status, records_processed, error_message, metadata, started_at, finished_at, triggered_by, created_at, updated_at')
    .single();

  if (error) return fail({ code: 'INGESTION_JOB_CREATE_FAILED', message: error.message }, 400);

  await writeAuditLog({
    actorId: user.id,
    action: 'ingestion_job.created',
    entity: 'ingestion_job',
    entityId: data.id,
    metadata: { orgId: data.org_id, sourceName: data.source_name, sourceType: data.source_type, status: data.status, via: 'api' },
  });

  return ok(data, undefined, 201);
}
