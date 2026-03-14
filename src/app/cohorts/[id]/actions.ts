'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { encodeMessage } from '@/lib/auth/messages';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/server/services/audit';

function parseDefinitionJson(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function createCohortVersionFromBuilderAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const cohortId = String(formData.get('cohortId') ?? '').trim();
  const definitionRaw = String(formData.get('definitionJson') ?? '').trim();
  if (!cohortId) redirect('/cohorts?error=' + encodeMessage('Missing cohort id.'));

  const definitionJson = parseDefinitionJson(definitionRaw || '{}');
  if (!definitionJson) {
    redirect(`/cohorts/${cohortId}/builder?error=` + encodeMessage('Definition JSON must be a valid object.'));
  }

  const latestVersionResult = await supabase
    .from('cohort_versions')
    .select('version_no')
    .eq('cohort_id', cohortId)
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestVersionResult.error) {
    redirect(`/cohorts/${cohortId}/builder?error=` + encodeMessage(latestVersionResult.error.message));
  }

  const nextVersionNo = (latestVersionResult.data?.version_no ?? 0) + 1;

  const insertResult = await supabase
    .from('cohort_versions')
    .insert({
      cohort_id: cohortId,
      version_no: nextVersionNo,
      definition_json: definitionJson,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (insertResult.error) {
    redirect(`/cohorts/${cohortId}/builder?error=` + encodeMessage(insertResult.error.message));
  }

  await writeAuditLog({
    actorId: user.id,
    action: 'cohort_version.created',
    entity: 'cohort_version',
    entityId: insertResult.data.id,
    metadata: { cohortId, versionNo: nextVersionNo },
  });

  revalidatePath('/cohorts');
  revalidatePath(`/cohorts/${cohortId}`);
  revalidatePath(`/cohorts/${cohortId}/builder`);
  redirect(`/cohorts/${cohortId}/builder?notice=` + encodeMessage(`Cohort version v${nextVersionNo} published.`));
}

export async function triggerCohortRunFromDetailAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const cohortId = String(formData.get('cohortId') ?? '').trim();
  const cohortVersionIdRaw = String(formData.get('cohortVersionId') ?? '').trim();
  if (!cohortId) redirect('/cohorts?error=' + encodeMessage('Missing cohort id.'));

  let cohortVersionId = cohortVersionIdRaw;
  if (!cohortVersionId) {
    const latestVersionResult = await supabase
      .from('cohort_versions')
      .select('id')
      .eq('cohort_id', cohortId)
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestVersionResult.error || !latestVersionResult.data) {
      redirect(`/cohorts/${cohortId}?error=` + encodeMessage('No cohort version found. Publish a version first.'));
    }
    cohortVersionId = latestVersionResult.data.id;
  }

  const runResult = await supabase
    .from('cohort_runs')
    .insert({
      cohort_version_id: cohortVersionId,
      status: 'queued',
      created_by: user.id,
    })
    .select('id')
    .single();

  if (runResult.error) {
    redirect(`/cohorts/${cohortId}?error=` + encodeMessage(runResult.error.message));
  }

  await writeAuditLog({
    actorId: user.id,
    action: 'cohort_run.triggered',
    entity: 'cohort_run',
    entityId: runResult.data.id,
    metadata: { cohortId, cohortVersionId },
  });

  revalidatePath('/cohorts');
  revalidatePath(`/cohorts/${cohortId}`);
  redirect(`/cohorts/${cohortId}?notice=` + encodeMessage('Cohort run queued successfully.'));
}

export async function updateCohortRunStatusAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const cohortId = String(formData.get('cohortId') ?? '').trim();
  const runId = String(formData.get('runId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (!cohortId || !runId || !status) redirect('/cohorts?error=' + encodeMessage('Missing run status update payload.'));

  const nowIso = new Date().toISOString();
  const updatePayload: Record<string, unknown> = { status };
  if (status === 'running') updatePayload.started_at = nowIso;
  if (status === 'completed' || status === 'failed') updatePayload.finished_at = nowIso;

  const runResult = await supabase
    .from('cohort_runs')
    .update(updatePayload)
    .eq('id', runId)
    .select('id')
    .single();

  if (runResult.error) {
    redirect(`/cohorts/${cohortId}?error=` + encodeMessage(runResult.error.message));
  }

  await writeAuditLog({
    actorId: user.id,
    action: 'cohort_run.status_updated',
    entity: 'cohort_run',
    entityId: runResult.data.id,
    metadata: { cohortId, status },
  });

  revalidatePath('/cohorts');
  revalidatePath(`/cohorts/${cohortId}`);
  redirect(`/cohorts/${cohortId}?notice=` + encodeMessage('Run status updated.'));
}
