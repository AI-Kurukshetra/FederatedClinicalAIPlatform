import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { writeAuditLog } from '@/server/services/audit';

export async function GET(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const url = new URL(request.url);
  const orgId = url.searchParams.get('orgId');
  if (!orgId) return fail({ code: 'VALIDATION_ERROR', message: 'orgId query param is required.' }, 422);

  const { data, error } = await supabase
    .from('connector_configs')
    .select('id, org_id, node_id, name, source_type, status, schedule_cron, config_json, last_sync_at, created_by, created_at, updated_at')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return fail({ code: 'CONNECTOR_CONFIG_LIST_FAILED', message: error.message }, 400);
  return ok(data);
}

export async function POST(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail({ code: 'VALIDATION_ERROR', message: 'Invalid connector payload.' }, 422);

  const { orgId, nodeId, name, sourceType, status, scheduleCron, configJson } = body as Record<string, unknown>;
  if (typeof orgId !== 'string' || typeof name !== 'string' || typeof sourceType !== 'string') {
    return fail({ code: 'VALIDATION_ERROR', message: 'orgId, name, and sourceType are required.' }, 422);
  }

  const { data, error } = await supabase
    .from('connector_configs')
    .insert({
      org_id: orgId,
      node_id: typeof nodeId === 'string' ? nodeId : null,
      name,
      source_type: sourceType,
      status: typeof status === 'string' ? status : 'active',
      schedule_cron: typeof scheduleCron === 'string' ? scheduleCron : null,
      config_json: configJson && typeof configJson === 'object' ? configJson : {},
      created_by: user.id,
    })
    .select('id, org_id, name, source_type, status, created_at')
    .single();

  if (error) return fail({ code: 'CONNECTOR_CONFIG_CREATE_FAILED', message: error.message }, 400);

  await writeAuditLog({
    actorId: user.id,
    action: 'connector_config.created',
    entity: 'connector_config',
    entityId: data.id,
    metadata: { orgId: data.org_id, sourceType: data.source_type, via: 'api' },
  });

  return ok(data, undefined, 201);
}
