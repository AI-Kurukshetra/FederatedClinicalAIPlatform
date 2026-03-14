import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { getPagination } from '@/lib/api/http';
import { createDataQualityMetricSchema } from '@/lib/validations/federation';
import { writeAuditLog } from '@/server/services/audit';

export async function GET(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const url = new URL(request.url);
  const orgId = url.searchParams.get('orgId');
  if (!orgId) return fail({ code: 'VALIDATION_ERROR', message: 'orgId query param is required.' }, 422);

  const sourceName = url.searchParams.get('sourceName');
  const { limit, offset } = getPagination(url.searchParams);

  let query = supabase
    .from('data_quality_metrics')
    .select('id, org_id, source_name, metric_name, metric_value, status, details, measured_at, created_by, created_at, updated_at')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .range(offset, offset + limit - 1)
    .order('measured_at', { ascending: false });

  if (sourceName) query = query.eq('source_name', sourceName);

  const { data, error } = await query;
  if (error) return fail({ code: 'DATA_QUALITY_LIST_FAILED', message: error.message }, 400);
  return ok(data, { limit, offset });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const body = await request.json().catch(() => null);
  const parsed = createDataQualityMetricSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: 'VALIDATION_ERROR', message: 'Invalid data quality payload.', details: parsed.error.flatten() }, 422);
  }

  const payload = {
    org_id: parsed.data.orgId,
    source_name: parsed.data.sourceName,
    metric_name: parsed.data.metricName,
    metric_value: parsed.data.metricValue,
    status: parsed.data.status,
    details: parsed.data.details ?? {},
    measured_at: parsed.data.measuredAt ?? null,
    created_by: user.id,
  };

  const { data, error } = await supabase
    .from('data_quality_metrics')
    .insert(payload)
    .select('id, org_id, source_name, metric_name, metric_value, status, details, measured_at, created_by, created_at, updated_at')
    .single();

  if (error) return fail({ code: 'DATA_QUALITY_CREATE_FAILED', message: error.message }, 400);

  await writeAuditLog({
    actorId: user.id,
    action: 'data_quality_metric.created',
    entity: 'data_quality_metric',
    entityId: data.id,
    metadata: { orgId: data.org_id, sourceName: data.source_name, metricName: data.metric_name, status: data.status, via: 'api' },
  });

  return ok(data, undefined, 201);
}
