import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { writeAuditLog } from '@/server/services/audit';

export async function GET(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const orgId = new URL(request.url).searchParams.get('orgId');
  if (!orgId) return fail({ code: 'VALIDATION_ERROR', message: 'orgId query param is required.' }, 422);

  const { data, error } = await supabase
    .from('clinical_trials')
    .select('id, org_id, study_id, trial_code, title, phase, status, criteria_json, target_enrollment, created_by, created_at, updated_at')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return fail({ code: 'CLINICAL_TRIAL_LIST_FAILED', message: error.message }, 400);
  return ok(data);
}

export async function POST(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail({ code: 'VALIDATION_ERROR', message: 'Invalid clinical trial payload.' }, 422);

  const { orgId, studyId, trialCode, title, phase, status, criteriaJson, targetEnrollment } = body as Record<string, unknown>;
  if (typeof orgId !== 'string' || typeof trialCode !== 'string' || typeof title !== 'string') {
    return fail({ code: 'VALIDATION_ERROR', message: 'orgId, trialCode, and title are required.' }, 422);
  }

  const { data, error } = await supabase
    .from('clinical_trials')
    .insert({
      org_id: orgId,
      study_id: typeof studyId === 'string' ? studyId : null,
      trial_code: trialCode,
      title,
      phase: typeof phase === 'string' ? phase : 'II',
      status: typeof status === 'string' ? status : 'open',
      criteria_json: criteriaJson && typeof criteriaJson === 'object' ? criteriaJson : {},
      target_enrollment: typeof targetEnrollment === 'number' ? targetEnrollment : null,
      created_by: user.id,
    })
    .select('id, org_id, trial_code, title, phase, status, target_enrollment, created_at')
    .single();

  if (error) return fail({ code: 'CLINICAL_TRIAL_CREATE_FAILED', message: error.message }, 400);

  await writeAuditLog({
    actorId: user.id,
    action: 'clinical_trial.created',
    entity: 'clinical_trial',
    entityId: data.id,
    metadata: { orgId: data.org_id, trialCode: data.trial_code, via: 'api' },
  });

  return ok(data, undefined, 201);
}
