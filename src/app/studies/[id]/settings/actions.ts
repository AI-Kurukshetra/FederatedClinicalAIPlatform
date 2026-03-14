'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { encodeMessage } from '@/lib/auth/messages';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/server/services/audit';

const allowedRoles = new Set(['owner', 'editor', 'viewer']);

export async function addStudyMemberAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const studyId = String(formData.get('studyId') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? 'viewer').trim();

  if (!studyId || !email) redirect('/studies?error=' + encodeMessage('Missing study member payload.'));
  if (!allowedRoles.has(role)) redirect(`/studies/${studyId}/settings?error=` + encodeMessage('Invalid study role.'));

  const profileResult = await supabase.from('profiles').select('id, email').eq('email', email).maybeSingle();
  if (profileResult.error || !profileResult.data) {
    redirect(`/studies/${studyId}/settings?error=` + encodeMessage('No account found with this email.'));
  }

  const upsertResult = await supabase
    .from('study_members')
    .upsert(
      {
        study_id: studyId,
        user_id: profileResult.data.id,
        role,
        deleted_at: null,
      },
      { onConflict: 'study_id,user_id' }
    )
    .select('study_id, user_id, role')
    .single();

  if (upsertResult.error) {
    redirect(`/studies/${studyId}/settings?error=` + encodeMessage(upsertResult.error.message));
  }

  await writeAuditLog({
    actorId: user.id,
    action: 'study_member.added',
    entity: 'study_member',
    entityId: `${upsertResult.data.study_id}:${upsertResult.data.user_id}`,
    metadata: { studyId, userId: upsertResult.data.user_id, role: upsertResult.data.role },
  });

  revalidatePath('/studies');
  revalidatePath(`/studies/${studyId}/settings`);
  redirect(`/studies/${studyId}/settings?notice=` + encodeMessage('Study member added/updated successfully.'));
}

export async function updateStudyMemberRoleAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const studyId = String(formData.get('studyId') ?? '').trim();
  const userId = String(formData.get('userId') ?? '').trim();
  const role = String(formData.get('role') ?? '').trim();

  if (!studyId || !userId || !role) redirect('/studies?error=' + encodeMessage('Missing study member update payload.'));
  if (!allowedRoles.has(role)) redirect(`/studies/${studyId}/settings?error=` + encodeMessage('Invalid study role.'));

  const updateResult = await supabase
    .from('study_members')
    .update({ role })
    .eq('study_id', studyId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .select('study_id, user_id, role')
    .single();

  if (updateResult.error) {
    redirect(`/studies/${studyId}/settings?error=` + encodeMessage(updateResult.error.message));
  }

  await writeAuditLog({
    actorId: user.id,
    action: 'study_member.role_updated',
    entity: 'study_member',
    entityId: `${updateResult.data.study_id}:${updateResult.data.user_id}`,
    metadata: { studyId, userId: updateResult.data.user_id, role: updateResult.data.role },
  });

  revalidatePath(`/studies/${studyId}/settings`);
  redirect(`/studies/${studyId}/settings?notice=` + encodeMessage('Study member role updated.'));
}

export async function removeStudyMemberAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const studyId = String(formData.get('studyId') ?? '').trim();
  const userId = String(formData.get('userId') ?? '').trim();
  if (!studyId || !userId) redirect('/studies?error=' + encodeMessage('Missing study member remove payload.'));

  const removeResult = await supabase
    .from('study_members')
    .update({ deleted_at: new Date().toISOString() })
    .eq('study_id', studyId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .select('study_id, user_id')
    .single();

  if (removeResult.error) {
    redirect(`/studies/${studyId}/settings?error=` + encodeMessage(removeResult.error.message));
  }

  await writeAuditLog({
    actorId: user.id,
    action: 'study_member.removed',
    entity: 'study_member',
    entityId: `${removeResult.data.study_id}:${removeResult.data.user_id}`,
    metadata: { studyId, userId: removeResult.data.user_id },
  });

  revalidatePath('/studies');
  revalidatePath(`/studies/${studyId}/settings`);
  redirect(`/studies/${studyId}/settings?notice=` + encodeMessage('Study member removed.'));
}
