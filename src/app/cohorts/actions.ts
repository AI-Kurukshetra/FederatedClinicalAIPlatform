'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { encodeMessage } from '@/lib/auth/messages';
import { getPrimaryOrgContext } from '@/server/services/org-context';
import { writeAuditLog } from '@/server/services/audit';

export async function createCohortAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const orgContext = await getPrimaryOrgContext(supabase, user.id);
  if (!orgContext) redirect('/cohorts?error=' + encodeMessage('No organization found for your account.'));

  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const studyId = String(formData.get('studyId') ?? '').trim();

  if (!name) redirect('/cohorts?error=' + encodeMessage('Cohort name is required.'));

  const { data, error } = await supabase
    .from('cohorts')
    .insert({
      org_id: orgContext.orgId,
      study_id: studyId || null,
      name,
      description: description || null,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) redirect('/cohorts?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'cohort.created',
    entity: 'cohort',
    entityId: data?.id,
    metadata: { orgId: orgContext.orgId, studyId: studyId || null },
  });

  revalidatePath('/cohorts');
  redirect('/cohorts?notice=' + encodeMessage('Cohort created successfully.'));
}

export async function archiveCohortAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/cohorts?error=' + encodeMessage('Missing cohort id.'));

  const { data, error } = await supabase
    .from('cohorts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, org_id')
    .single();

  if (error) redirect('/cohorts?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'cohort.archived',
    entity: 'cohort',
    entityId: data.id,
    metadata: { orgId: data.org_id },
  });

  revalidatePath('/cohorts');
  redirect('/cohorts?notice=' + encodeMessage('Cohort archived.'));
}

export async function restoreCohortAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/cohorts?error=' + encodeMessage('Missing cohort id.'));

  const { data, error } = await supabase
    .from('cohorts')
    .update({ deleted_at: null })
    .eq('id', id)
    .not('deleted_at', 'is', null)
    .select('id, org_id')
    .single();

  if (error) redirect('/cohorts?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'cohort.restored',
    entity: 'cohort',
    entityId: data.id,
    metadata: { orgId: data.org_id },
  });

  revalidatePath('/cohorts');
  redirect('/cohorts?notice=' + encodeMessage('Cohort restored.'));
}
