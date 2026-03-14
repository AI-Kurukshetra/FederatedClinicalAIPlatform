import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { writeAuditLog } from '@/server/services/audit';

export async function GET(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const orgId = new URL(request.url).searchParams.get('orgId');
  if (!orgId) return fail({ code: 'VALIDATION_ERROR', message: 'orgId query param is required.' }, 422);

  const { data, error } = await supabase
    .from('policy_configs')
    .select('id, org_id, policy_key, policy_name, policy_type, status, version_no, config_json, created_by, created_at')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return fail({ code: 'POLICY_LIST_FAILED', message: error.message }, 400);
  return ok(data);
}

export async function POST(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail({ code: 'VALIDATION_ERROR', message: 'Invalid policy payload.' }, 422);

  const { orgId, policyKey, policyName, policyType, status, versionNo, configJson } = body as Record<string, unknown>;
  if (typeof orgId !== 'string' || typeof policyKey !== 'string' || typeof policyName !== 'string') {
    return fail({ code: 'VALIDATION_ERROR', message: 'orgId, policyKey, and policyName are required.' }, 422);
  }

  const { data, error } = await supabase
    .from('policy_configs')
    .insert({
      org_id: orgId,
      policy_key: policyKey,
      policy_name: policyName,
      policy_type: typeof policyType === 'string' ? policyType : 'access',
      status: typeof status === 'string' ? status : 'draft',
      version_no: typeof versionNo === 'number' ? versionNo : 1,
      config_json: configJson && typeof configJson === 'object' ? configJson : {},
      created_by: user.id,
    })
    .select('id, org_id, policy_key, policy_name, policy_type, status, version_no, created_at')
    .single();

  if (error) return fail({ code: 'POLICY_CREATE_FAILED', message: error.message }, 400);

  await writeAuditLog({
    actorId: user.id,
    action: 'policy_config.created',
    entity: 'policy_config',
    entityId: data.id,
    metadata: { orgId: data.org_id, policyKey: data.policy_key, via: 'api' },
  });

  return ok(data, undefined, 201);
}
