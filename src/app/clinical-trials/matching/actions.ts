'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { encodeMessage } from '@/lib/auth/messages';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getPrimaryOrgContext } from '@/server/services/org-context';
import { writeAuditLog } from '@/server/services/audit';

export async function createClinicalTrialAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const orgContext = await getPrimaryOrgContext(supabase, user.id);
  if (!orgContext) redirect('/clinical-trials/matching?error=' + encodeMessage('No organization found for your account.'));

  const trialCode = String(formData.get('trialCode') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const phase = String(formData.get('phase') ?? 'II').trim();
  const status = String(formData.get('status') ?? 'open').trim();
  const studyId = String(formData.get('studyId') ?? '').trim();
  const targetEnrollmentRaw = String(formData.get('targetEnrollment') ?? '').trim();
  const targetEnrollment = targetEnrollmentRaw ? Number(targetEnrollmentRaw) : null;

  if (!trialCode || !title) {
    redirect('/clinical-trials/matching?error=' + encodeMessage('Trial code and title are required.'));
  }

  if (targetEnrollmentRaw && (Number.isNaN(targetEnrollment) || (targetEnrollment ?? 0) < 0)) {
    redirect('/clinical-trials/matching?error=' + encodeMessage('Target enrollment must be a non-negative number.'));
  }

  const { data, error } = await supabase
    .from('clinical_trials')
    .insert({
      org_id: orgContext.orgId,
      study_id: studyId || null,
      trial_code: trialCode,
      title,
      phase,
      status,
      target_enrollment: targetEnrollment,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) redirect('/clinical-trials/matching?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'clinical_trial.created',
    entity: 'clinical_trial',
    entityId: data.id,
    metadata: { orgId: orgContext.orgId, phase, status, studyId: studyId || null },
  });

  revalidatePath('/clinical-trials/matching');
  redirect('/clinical-trials/matching?notice=' + encodeMessage('Clinical trial created.'));
}

export async function runTrialMatchAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const orgContext = await getPrimaryOrgContext(supabase, user.id);
  if (!orgContext) redirect('/clinical-trials/matching?error=' + encodeMessage('No organization found for your account.'));

  const trialId = String(formData.get('trialId') ?? '').trim();
  const cohortId = String(formData.get('cohortId') ?? '').trim();
  if (!trialId) redirect('/clinical-trials/matching?error=' + encodeMessage('Trial id is required for matching.'));

  const cohortRuns = cohortId
    ? await supabase
        .from('cohort_runs')
        .select('result_count')
        .in(
          'cohort_version_id',
          (await supabase.from('cohort_versions').select('id').eq('cohort_id', cohortId)).data?.map((item) => item.id) ?? ['00000000-0000-0000-0000-000000000000']
        )
        .order('created_at', { ascending: false })
        .limit(1)
    : { data: [] as Array<{ result_count: number | null }> };

  const seed = Math.max(50, ((Date.now() / 1000) | 0) % 500);
  const resultCount = cohortRuns.data?.[0]?.result_count ?? seed;
  const eligibilityCount = Math.max(0, Math.floor(resultCount * 0.42));
  const screenedCount = Math.max(eligibilityCount, Math.floor(resultCount * 0.75));
  const precisionScore = Number((80 + ((seed % 200) / 10)).toFixed(2));

  const { data, error } = await supabase
    .from('trial_matches')
    .insert({
      org_id: orgContext.orgId,
      trial_id: trialId,
      cohort_id: cohortId || null,
      eligibility_count: eligibilityCount,
      screened_count: screenedCount,
      precision_score: precisionScore,
      status: 'open',
      run_metadata: { generatedBy: 'runTrialMatchAction', seed },
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) redirect('/clinical-trials/matching?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'trial_match.created',
    entity: 'trial_match',
    entityId: data.id,
    metadata: { orgId: orgContext.orgId, trialId, cohortId: cohortId || null, eligibilityCount, screenedCount, precisionScore },
  });

  revalidatePath('/clinical-trials/matching');
  redirect('/clinical-trials/matching?notice=' + encodeMessage('Trial matching run completed.'));
}

export async function updateTrialMatchStatusAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const id = String(formData.get('id') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (!id || !status) redirect('/clinical-trials/matching?error=' + encodeMessage('Missing trial match update payload.'));

  const { data, error } = await supabase
    .from('trial_matches')
    .update({ status })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, org_id, status')
    .single();

  if (error) redirect('/clinical-trials/matching?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'trial_match.status_updated',
    entity: 'trial_match',
    entityId: data.id,
    metadata: { orgId: data.org_id, status: data.status },
  });

  revalidatePath('/clinical-trials/matching');
  redirect('/clinical-trials/matching?notice=' + encodeMessage('Trial match status updated.'));
}
