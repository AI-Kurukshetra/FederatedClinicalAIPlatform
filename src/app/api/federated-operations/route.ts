import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { writeAuditLog } from '@/server/services/audit';

export async function GET(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const orgId = new URL(request.url).searchParams.get('orgId');
  if (!orgId) return fail({ code: 'VALIDATION_ERROR', message: 'orgId query param is required.' }, 422);

  const { data, error } = await supabase
    .from('federated_operations')
    .select('id, org_id, node_id, operation_type, status, priority, queued_at, started_at, finished_at, created_by, created_at')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('queued_at', { ascending: false })
    .limit(200);

  if (error) return fail({ code: 'FEDERATED_OPERATION_LIST_FAILED', message: error.message }, 400);
  return ok(data);
}

export async function POST(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail({ code: 'VALIDATION_ERROR', message: 'Invalid operation payload.' }, 422);

  const { orgId, nodeId, operationType, priority, payload } = body as Record<string, unknown>;
  if (typeof orgId !== 'string' || typeof operationType !== 'string') {
    return fail({ code: 'VALIDATION_ERROR', message: 'orgId and operationType are required.' }, 422);
  }

  const { data, error } = await supabase
    .from('federated_operations')
    .insert({
      org_id: orgId,
      node_id: typeof nodeId === 'string' ? nodeId : null,
      operation_type: operationType,
      status: 'queued',
      priority: typeof priority === 'number' ? priority : 50,
      payload: payload && typeof payload === 'object' ? payload : {},
      created_by: user.id,
    })
    .select('id, org_id, node_id, operation_type, status, priority, queued_at, created_at')
    .single();

  if (error) return fail({ code: 'FEDERATED_OPERATION_CREATE_FAILED', message: error.message }, 400);

  await writeAuditLog({
    actorId: user.id,
    action: 'federated_operation.queued',
    entity: 'federated_operation',
    entityId: data.id,
    metadata: { orgId: data.org_id, operationType: data.operation_type, via: 'api' },
  });

  return ok(data, undefined, 201);
}
