'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { encodeMessage } from '@/lib/auth/messages';
import { getPrimaryOrgContext } from '@/server/services/org-context';
import { writeAuditLog } from '@/server/services/audit';

export async function createStudyAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const orgContext = await getPrimaryOrgContext(supabase, user.id);
  if (!orgContext) redirect('/studies?error=' + encodeMessage('No organization found for your account.'));

  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const status = String(formData.get('status') ?? 'draft');

  if (!name) redirect('/studies?error=' + encodeMessage('Study name is required.'));

  const { data, error } = await supabase
    .from('studies')
    .insert({
      org_id: orgContext.orgId,
      name,
      description: description || null,
      status,
      owner_id: user.id,
    })
    .select('id')
    .single();

  if (error) redirect('/studies?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'study.created',
    entity: 'study',
    entityId: data?.id,
    metadata: { orgId: orgContext.orgId, status },
  });

  revalidatePath('/studies');
  redirect('/studies?notice=' + encodeMessage('Study created successfully.'));
}

export async function updateStudyStatusAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const id = String(formData.get('id') ?? '').trim();
  const status = String(formData.get('status') ?? 'draft');
  if (!id) redirect('/studies?error=' + encodeMessage('Missing study id.'));

  const { data, error } = await supabase
    .from('studies')
    .update({ status })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, org_id, status')
    .single();

  if (error) redirect('/studies?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'study.status_updated',
    entity: 'study',
    entityId: data.id,
    metadata: { orgId: data.org_id, status: data.status },
  });

  revalidatePath('/studies');
  redirect('/studies?notice=' + encodeMessage('Study status updated.'));
}

export async function archiveStudyAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/studies?error=' + encodeMessage('Missing study id.'));

  const { data, error } = await supabase
    .from('studies')
    .update({ status: 'archived', deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, org_id')
    .single();

  if (error) redirect('/studies?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'study.archived',
    entity: 'study',
    entityId: data.id,
    metadata: { orgId: data.org_id },
  });

  revalidatePath('/studies');
  redirect('/studies?notice=' + encodeMessage('Study archived.'));
}

export async function restoreStudyAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/studies?error=' + encodeMessage('Missing study id.'));

  const { data, error } = await supabase
    .from('studies')
    .update({ deleted_at: null, status: 'draft' })
    .eq('id', id)
    .not('deleted_at', 'is', null)
    .select('id, org_id')
    .single();

  if (error) redirect('/studies?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'study.restored',
    entity: 'study',
    entityId: data.id,
    metadata: { orgId: data.org_id },
  });

  revalidatePath('/studies');
  redirect('/studies?notice=' + encodeMessage('Study restored.'));
}
