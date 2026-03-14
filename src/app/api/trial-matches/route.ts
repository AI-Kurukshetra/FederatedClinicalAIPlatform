import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { writeAuditLog } from '@/server/services/audit';

export async function GET(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const orgId = new URL(request.url).searchParams.get('orgId');
  if (!orgId) return fail({ code: 'VALIDATION_ERROR', message: 'orgId query param is required.' }, 422);

  const { data, error } = await supabase
    .from('trial_matches')
    .select('id, org_id, trial_id, cohort_id, eligibility_count, screened_count, precision_score, status, run_metadata, matched_at, created_by, created_at')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('matched_at', { ascending: false })
    .limit(300);

  if (error) return fail({ code: 'TRIAL_MATCH_LIST_FAILED', message: error.message }, 400);
  return ok(data);
}

export async function POST(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail({ code: 'VALIDATION_ERROR', message: 'Invalid trial match payload.' }, 422);

  const { orgId, trialId, cohortId, eligibilityCount, screenedCount, precisionScore, status, runMetadata } = body as Record<string, unknown>;
  if (typeof orgId !== 'string' || typeof trialId !== 'string') {
    return fail({ code: 'VALIDATION_ERROR', message: 'orgId and trialId are required.' }, 422);
  }

  const { data, error } = await supabase
    .from('trial_matches')
    .insert({
      org_id: orgId,
      trial_id: trialId,
      cohort_id: typeof cohortId === 'string' ? cohortId : null,
      eligibility_count: typeof eligibilityCount === 'number' ? eligibilityCount : 0,
      screened_count: typeof screenedCount === 'number' ? screenedCount : 0,
      precision_score: typeof precisionScore === 'number' ? precisionScore : null,
      status: typeof status === 'string' ? status : 'open',
      run_metadata: runMetadata && typeof runMetadata === 'object' ? runMetadata : {},
      created_by: user.id,
    })
    .select('id, org_id, trial_id, cohort_id, eligibility_count, screened_count, precision_score, status, matched_at')
    .single();

  if (error) return fail({ code: 'TRIAL_MATCH_CREATE_FAILED', message: error.message }, 400);

  await writeAuditLog({
    actorId: user.id,
    action: 'trial_match.created',
    entity: 'trial_match',
    entityId: data.id,
    metadata: { orgId: data.org_id, trialId: data.trial_id, via: 'api' },
  });

  return ok(data, undefined, 201);
}
