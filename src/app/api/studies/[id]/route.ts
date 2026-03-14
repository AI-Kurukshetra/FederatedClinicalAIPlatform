import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { updateStudySchema } from '@/lib/validations/study';
import { writeAuditLog } from '@/server/services/audit';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, context: Params) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const { id } = await context.params;
  const { data, error } = await supabase
    .from('studies')
    .select('id, org_id, name, description, status, owner_id, created_at, updated_at')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) return fail({ code: 'STUDY_FETCH_FAILED', message: error.message }, 404);
  return ok(data);
}

export async function PATCH(request: Request, context: Params) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateStudySchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: 'VALIDATION_ERROR', message: 'Invalid study patch payload.', details: parsed.error.flatten() }, 422);
  }

  const { data, error } = await supabase
    .from('studies')
    .update(parsed.data)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, org_id, name, description, status, owner_id, created_at, updated_at')
    .single();

  if (error) return fail({ code: 'STUDY_UPDATE_FAILED', message: error.message }, 400);

  await writeAuditLog({
    actorId: user.id,
    action: 'study.updated',
    entity: 'study',
    entityId: data.id,
    metadata: { patch: parsed.data },
  });

  return ok(data);
}
