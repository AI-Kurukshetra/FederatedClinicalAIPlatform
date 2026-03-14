import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { getPagination } from '@/lib/api/http';
import { createCohortSchema } from '@/lib/validations/cohort';

export async function GET(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const url = new URL(request.url);
  const orgId = url.searchParams.get('orgId');
  if (!orgId) return fail({ code: 'VALIDATION_ERROR', message: 'orgId query param is required.' }, 422);

  const { limit, offset } = getPagination(url.searchParams);
  const { data, error } = await supabase
    .from('cohorts')
    .select('id, org_id, study_id, name, description, created_by, created_at, updated_at')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  if (error) return fail({ code: 'COHORT_LIST_FAILED', message: error.message }, 400);
  return ok(data, { limit, offset });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const body = await request.json().catch(() => null);
  const parsed = createCohortSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: 'VALIDATION_ERROR', message: 'Invalid cohort payload.', details: parsed.error.flatten() }, 422);
  }

  const { data, error } = await supabase
    .from('cohorts')
    .insert({
      org_id: parsed.data.orgId,
      study_id: parsed.data.studyId ?? null,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      created_by: user.id,
    })
    .select('id, org_id, study_id, name, description, created_by, created_at, updated_at')
    .single();

  if (error) return fail({ code: 'COHORT_CREATE_FAILED', message: error.message }, 400);
  return ok(data, undefined, 201);
}

