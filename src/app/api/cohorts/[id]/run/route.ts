import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { createCohortRunSchema } from '@/lib/validations/cohort';

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: Params) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = createCohortRunSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: 'VALIDATION_ERROR', message: 'Invalid cohort run payload.', details: parsed.error.flatten() }, 422);
  }

  let cohortVersionId = parsed.data.cohortVersionId;
  if (!cohortVersionId) {
    const latestVersion = await supabase
      .from('cohort_versions')
      .select('id, version_no')
      .eq('cohort_id', id)
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestVersion.error) return fail({ code: 'COHORT_VERSION_FETCH_FAILED', message: latestVersion.error.message }, 400);
    if (!latestVersion.data) {
      return fail({ code: 'COHORT_VERSION_REQUIRED', message: 'No cohort version found. Create a version before run.' }, 400);
    }
    cohortVersionId = latestVersion.data.id;
  }

  const { data, error } = await supabase
    .from('cohort_runs')
    .insert({
      cohort_version_id: cohortVersionId,
      status: 'queued',
      created_by: user.id,
    })
    .select('id, cohort_version_id, status, result_count, created_by, created_at, started_at, finished_at')
    .single();

  if (error) return fail({ code: 'COHORT_RUN_CREATE_FAILED', message: error.message }, 400);
  return ok(data, undefined, 201);
}
