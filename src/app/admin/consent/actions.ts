'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { encodeMessage } from '@/lib/auth/messages';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getPrimaryOrgContext } from '@/server/services/org-context';
import { writeAuditLog } from '@/server/services/audit';

export async function createConsentRecordAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const orgContext = await getPrimaryOrgContext(supabase, user.id);
  if (!orgContext) redirect('/admin/consent?error=' + encodeMessage('No organization found for your account.'));

  const subjectRef = String(formData.get('subjectRef') ?? '').trim();
  const consentType = String(formData.get('consentType') ?? 'research').trim();
  const status = String(formData.get('status') ?? 'granted').trim();
  const expiresAtRaw = String(formData.get('expiresAt') ?? '').trim();
  const evidenceRef = String(formData.get('evidenceRef') ?? '').trim();

  if (!subjectRef) redirect('/admin/consent?error=' + encodeMessage('Subject reference is required.'));

  const { data, error } = await supabase
    .from('consent_records')
    .insert({
      org_id: orgContext.orgId,
      subject_ref: subjectRef,
      consent_type: consentType,
      status,
      expires_at: expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null,
      evidence_ref: evidenceRef || null,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) redirect('/admin/consent?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'consent_record.created',
    entity: 'consent_record',
    entityId: data.id,
    metadata: { orgId: orgContext.orgId, consentType, status },
  });

  revalidatePath('/admin/consent');
  revalidatePath('/admin/compliance');
  redirect('/admin/consent?notice=' + encodeMessage('Consent record created.'));
}

export async function updateConsentStatusAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const id = String(formData.get('id') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (!id || !status) redirect('/admin/consent?error=' + encodeMessage('Missing consent status payload.'));

  const { data, error } = await supabase
    .from('consent_records')
    .update({ status })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, org_id, status')
    .single();

  if (error) redirect('/admin/consent?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'consent_record.status_updated',
    entity: 'consent_record',
    entityId: data.id,
    metadata: { orgId: data.org_id, status: data.status },
  });

  revalidatePath('/admin/consent');
  revalidatePath('/admin/compliance');
  redirect('/admin/consent?notice=' + encodeMessage('Consent status updated.'));
}
