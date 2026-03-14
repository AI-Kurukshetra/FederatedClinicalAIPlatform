import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { createCohortVersionSchema } from '@/lib/validations/cohort';

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: Params) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = createCohortVersionSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: 'VALIDATION_ERROR', message: 'Invalid cohort version payload.', details: parsed.error.flatten() }, 422);
  }

  const { data, error } = await supabase
    .from('cohort_versions')
    .insert({
      cohort_id: id,
      version_no: parsed.data.versionNo,
      definition_json: parsed.data.definitionJson,
      created_by: user.id,
    })
    .select('id, cohort_id, version_no, definition_json, created_by, created_at')
    .single();

  if (error) return fail({ code: 'COHORT_VERSION_CREATE_FAILED', message: error.message }, 400);
  return ok(data, undefined, 201);
}
