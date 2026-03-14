import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { getPagination } from '@/lib/api/http';
import { createStudySchema } from '@/lib/validations/study';
import { writeAuditLog } from '@/server/services/audit';

export async function GET(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const url = new URL(request.url);
  const orgId = url.searchParams.get('orgId');
  if (!orgId) return fail({ code: 'VALIDATION_ERROR', message: 'orgId query param is required.' }, 422);

  const { limit, offset } = getPagination(url.searchParams);
  const { data, error } = await supabase
    .from('studies')
    .select('id, org_id, name, description, status, owner_id, created_at, updated_at')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  if (error) return fail({ code: 'STUDIES_LIST_FAILED', message: error.message }, 400);
  return ok(data, { limit, offset });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const body = await request.json().catch(() => null);
  const parsed = createStudySchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: 'VALIDATION_ERROR', message: 'Invalid study payload.', details: parsed.error.flatten() }, 422);
  }

  const payload = {
    org_id: parsed.data.orgId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    status: parsed.data.status,
    owner_id: user.id,
  };

  const { data, error } = await supabase
    .from('studies')
    .insert(payload)
    .select('id, org_id, name, description, status, owner_id, created_at, updated_at')
    .single();

  if (error) return fail({ code: 'STUDY_CREATE_FAILED', message: error.message }, 400);

  await writeAuditLog({
    actorId: user.id,
    action: 'study.created',
    entity: 'study',
    entityId: data.id,
    metadata: { orgId: data.org_id, status: data.status, via: 'api' },
  });

  return ok(data, undefined, 201);
}

