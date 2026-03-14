'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { encodeMessage } from '@/lib/auth/messages';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getPrimaryOrgContext } from '@/server/services/org-context';
import { writeAuditLog } from '@/server/services/audit';

export async function createPolicyConfigAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const orgContext = await getPrimaryOrgContext(supabase, user.id);
  if (!orgContext) redirect('/admin/policies?error=' + encodeMessage('No organization found for your account.'));

  const policyKey = String(formData.get('policyKey') ?? '').trim();
  const policyName = String(formData.get('policyName') ?? '').trim();
  const policyType = String(formData.get('policyType') ?? 'access').trim();
  const status = String(formData.get('status') ?? 'draft').trim();
  const configJsonRaw = String(formData.get('configJson') ?? '').trim();

  if (!policyKey || !policyName) redirect('/admin/policies?error=' + encodeMessage('Policy key and name are required.'));

  let configJson: Record<string, unknown> = {};
  if (configJsonRaw) {
    try {
      const parsed = JSON.parse(configJsonRaw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error();
      configJson = parsed as Record<string, unknown>;
    } catch {
      redirect('/admin/policies?error=' + encodeMessage('Policy config JSON must be a valid object.'));
    }
  }

  const versionResult = await supabase
    .from('policy_configs')
    .select('version_no')
    .eq('org_id', orgContext.orgId)
    .eq('policy_key', policyKey)
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (versionResult.data?.version_no ?? 0) + 1;

  const { data, error } = await supabase
    .from('policy_configs')
    .insert({
      org_id: orgContext.orgId,
      policy_key: policyKey,
      policy_name: policyName,
      policy_type: policyType,
      status,
      config_json: configJson,
      version_no: nextVersion,
      created_by: user.id,
    })
    .select('id, version_no')
    .single();

  if (error) redirect('/admin/policies?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'policy_config.created',
    entity: 'policy_config',
    entityId: data.id,
    metadata: { orgId: orgContext.orgId, policyKey, policyType, status, versionNo: data.version_no },
  });

  revalidatePath('/admin/policies');
  revalidatePath('/admin/compliance');
  redirect('/admin/policies?notice=' + encodeMessage(`Policy version v${data.version_no} created.`));
}

export async function updatePolicyStatusAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const id = String(formData.get('id') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (!id || !status) redirect('/admin/policies?error=' + encodeMessage('Missing policy status payload.'));

  const { data, error } = await supabase
    .from('policy_configs')
    .update({ status })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, org_id, status')
    .single();

  if (error) redirect('/admin/policies?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'policy_config.status_updated',
    entity: 'policy_config',
    entityId: data.id,
    metadata: { orgId: data.org_id, status: data.status },
  });

  revalidatePath('/admin/policies');
  redirect('/admin/policies?notice=' + encodeMessage('Policy status updated.'));
}
