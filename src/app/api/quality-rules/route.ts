import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { writeAuditLog } from '@/server/services/audit';

export async function GET(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const orgId = new URL(request.url).searchParams.get('orgId');
  if (!orgId) return fail({ code: 'VALIDATION_ERROR', message: 'orgId query param is required.' }, 422);

  const { data, error } = await supabase
    .from('quality_rules')
    .select('id, org_id, connector_id, rule_name, metric_name, threshold, comparator, severity, is_active, created_by, created_at, updated_at')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return fail({ code: 'QUALITY_RULE_LIST_FAILED', message: error.message }, 400);
  return ok(data);
}

export async function POST(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail({ code: 'VALIDATION_ERROR', message: 'Invalid quality rule payload.' }, 422);

  const { orgId, connectorId, ruleName, metricName, threshold, comparator, severity } = body as Record<string, unknown>;
  if (typeof orgId !== 'string' || typeof ruleName !== 'string' || typeof metricName !== 'string' || typeof threshold !== 'number') {
    return fail({ code: 'VALIDATION_ERROR', message: 'orgId, ruleName, metricName, and threshold are required.' }, 422);
  }

  const { data, error } = await supabase
    .from('quality_rules')
    .insert({
      org_id: orgId,
      connector_id: typeof connectorId === 'string' ? connectorId : null,
      rule_name: ruleName,
      metric_name: metricName,
      threshold,
      comparator: typeof comparator === 'string' ? comparator : 'gte',
      severity: typeof severity === 'string' ? severity : 'warning',
      created_by: user.id,
    })
    .select('id, org_id, rule_name, metric_name, threshold, comparator, severity, is_active, created_at')
    .single();

  if (error) return fail({ code: 'QUALITY_RULE_CREATE_FAILED', message: error.message }, 400);

  await writeAuditLog({
    actorId: user.id,
    action: 'quality_rule.created',
    entity: 'quality_rule',
    entityId: data.id,
    metadata: { orgId: data.org_id, metricName: data.metric_name, via: 'api' },
  });

  return ok(data, undefined, 201);
}
