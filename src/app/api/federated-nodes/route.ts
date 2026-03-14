import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { getPagination } from '@/lib/api/http';
import { createFederatedNodeSchema } from '@/lib/validations/federation';
import { writeAuditLog } from '@/server/services/audit';

export async function GET(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const url = new URL(request.url);
  const orgId = url.searchParams.get('orgId');
  if (!orgId) return fail({ code: 'VALIDATION_ERROR', message: 'orgId query param is required.' }, 422);

  const status = url.searchParams.get('status');
  const { limit, offset } = getPagination(url.searchParams);

  let query = supabase
    .from('federated_nodes')
    .select('id, org_id, name, slug, region, endpoint_url, status, capabilities, last_heartbeat_at, created_by, created_at, updated_at')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return fail({ code: 'FEDERATED_NODES_LIST_FAILED', message: error.message }, 400);
  return ok(data, { limit, offset });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const body = await request.json().catch(() => null);
  const parsed = createFederatedNodeSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: 'VALIDATION_ERROR', message: 'Invalid federated node payload.', details: parsed.error.flatten() }, 422);
  }

  const payload = {
    org_id: parsed.data.orgId,
    name: parsed.data.name,
    slug: parsed.data.slug,
    region: parsed.data.region,
    endpoint_url: parsed.data.endpointUrl ?? null,
    status: parsed.data.status,
    capabilities: parsed.data.capabilities ?? {},
    created_by: user.id,
  };

  const { data, error } = await supabase
    .from('federated_nodes')
    .insert(payload)
    .select('id, org_id, name, slug, region, endpoint_url, status, capabilities, last_heartbeat_at, created_by, created_at, updated_at')
    .single();

  if (error) return fail({ code: 'FEDERATED_NODE_CREATE_FAILED', message: error.message }, 400);

  await writeAuditLog({
    actorId: user.id,
    action: 'federated_node.created',
    entity: 'federated_node',
    entityId: data.id,
    metadata: { orgId: data.org_id, status: data.status, region: data.region, via: 'api' },
  });

  return ok(data, undefined, 201);
}
