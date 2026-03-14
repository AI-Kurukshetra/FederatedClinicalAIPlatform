'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { encodeMessage } from '@/lib/auth/messages';
import { getPrimaryOrgContext } from '@/server/services/org-context';
import { slugify } from '@/lib/utils/slugify';
import { writeAuditLog } from '@/server/services/audit';

export async function createFederatedNodeAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const orgContext = await getPrimaryOrgContext(supabase, user.id);
  if (!orgContext) redirect('/federated-nodes?error=' + encodeMessage('No organization found for your account.'));

  const name = String(formData.get('name') ?? '').trim();
  const region = String(formData.get('region') ?? '').trim();
  const endpointUrl = String(formData.get('endpointUrl') ?? '').trim();
  const status = String(formData.get('status') ?? 'online');

  if (!name || !region) {
    redirect('/federated-nodes?error=' + encodeMessage('Node name and region are required.'));
  }

  const { data, error } = await supabase
    .from('federated_nodes')
    .insert({
      org_id: orgContext.orgId,
      name,
      slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`,
      region,
      endpoint_url: endpointUrl || null,
      status,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) redirect('/federated-nodes?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'federated_node.created',
    entity: 'federated_node',
    entityId: data?.id,
    metadata: { orgId: orgContext.orgId, region, status },
  });

  revalidatePath('/federated-nodes');
  redirect('/federated-nodes?notice=' + encodeMessage('Federated node created.'));
}

export async function updateFederatedNodeStatusAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const id = String(formData.get('id') ?? '').trim();
  const status = String(formData.get('status') ?? 'online');
  if (!id) redirect('/federated-nodes?error=' + encodeMessage('Missing node id.'));

  const { data, error } = await supabase
    .from('federated_nodes')
    .update({ status, last_heartbeat_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, org_id, status')
    .single();

  if (error) redirect('/federated-nodes?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'federated_node.status_updated',
    entity: 'federated_node',
    entityId: data.id,
    metadata: { orgId: data.org_id, status: data.status },
  });

  revalidatePath('/federated-nodes');
  redirect('/federated-nodes?notice=' + encodeMessage('Node status updated.'));
}

export async function archiveFederatedNodeAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/federated-nodes?error=' + encodeMessage('Missing node id.'));

  const { data, error } = await supabase
    .from('federated_nodes')
    .update({ deleted_at: new Date().toISOString(), status: 'offline' })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, org_id')
    .single();

  if (error) redirect('/federated-nodes?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'federated_node.archived',
    entity: 'federated_node',
    entityId: data.id,
    metadata: { orgId: data.org_id },
  });

  revalidatePath('/federated-nodes');
  redirect('/federated-nodes?notice=' + encodeMessage('Node archived.'));
}

export async function restoreFederatedNodeAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/federated-nodes?error=' + encodeMessage('Missing node id.'));

  const { data, error } = await supabase
    .from('federated_nodes')
    .update({ deleted_at: null, status: 'online', last_heartbeat_at: new Date().toISOString() })
    .eq('id', id)
    .not('deleted_at', 'is', null)
    .select('id, org_id')
    .single();

  if (error) redirect('/federated-nodes?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'federated_node.restored',
    entity: 'federated_node',
    entityId: data.id,
    metadata: { orgId: data.org_id },
  });

  revalidatePath('/federated-nodes');
  redirect('/federated-nodes?notice=' + encodeMessage('Node restored.'));
}

export async function runConnectivityCheckAction() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const orgContext = await getPrimaryOrgContext(supabase, user.id);
  if (!orgContext) redirect('/federated-nodes?error=' + encodeMessage('No organization found for your account.'));

  const nowIso = new Date().toISOString();
  const { data: nodes } = await supabase
    .from('federated_nodes')
    .select('id, status')
    .eq('org_id', orgContext.orgId)
    .is('deleted_at', null);

  let checked = 0;
  for (const node of nodes ?? []) {
    const nextStatus = node.status === 'offline' ? 'degraded' : 'online';
    const { error } = await supabase
      .from('federated_nodes')
      .update({ status: nextStatus, last_heartbeat_at: nowIso })
      .eq('id', node.id);
    if (!error) checked += 1;
  }

  await writeAuditLog({
    actorId: user.id,
    action: 'federated_nodes.connectivity_check',
    entity: 'federated_node',
    metadata: { orgId: orgContext.orgId, checked },
  });

  revalidatePath('/federated-nodes');
  redirect('/federated-nodes?notice=' + encodeMessage(`Connectivity check completed for ${checked} node(s).`));
}

export async function queueFederatedOperationAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const orgContext = await getPrimaryOrgContext(supabase, user.id);
  if (!orgContext) redirect('/federated-nodes?error=' + encodeMessage('No organization found for your account.'));

  const nodeId = String(formData.get('nodeId') ?? '').trim();
  const operationType = String(formData.get('operationType') ?? 'connectivity_check').trim();
  const priorityRaw = String(formData.get('priority') ?? '50').trim();
  const priority = Number(priorityRaw);

  if (Number.isNaN(priority) || priority < 1 || priority > 100) {
    redirect('/federated-nodes?error=' + encodeMessage('Operation priority must be between 1 and 100.'));
  }

  const { data, error } = await supabase
    .from('federated_operations')
    .insert({
      org_id: orgContext.orgId,
      node_id: nodeId || null,
      operation_type: operationType,
      status: 'queued',
      priority,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) redirect('/federated-nodes?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'federated_operation.queued',
    entity: 'federated_operation',
    entityId: data.id,
    metadata: { orgId: orgContext.orgId, nodeId: nodeId || null, operationType, priority },
  });

  revalidatePath('/federated-nodes');
  redirect('/federated-nodes?notice=' + encodeMessage('Operation queued.'));
}

export async function claimNextOperationAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const orgContext = await getPrimaryOrgContext(supabase, user.id);
  if (!orgContext) redirect('/federated-nodes?error=' + encodeMessage('No organization found for your account.'));

  const nodeId = String(formData.get('nodeId') ?? '').trim();
  if (!nodeId) redirect('/federated-nodes?error=' + encodeMessage('Node id is required to claim operation.'));

  const queuedResult = await supabase
    .from('federated_operations')
    .select('id')
    .eq('org_id', orgContext.orgId)
    .eq('status', 'queued')
    .or(`node_id.is.null,node_id.eq.${nodeId}`)
    .is('deleted_at', null)
    .order('priority', { ascending: true })
    .order('queued_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (queuedResult.error) redirect('/federated-nodes?error=' + encodeMessage(queuedResult.error.message));
  if (!queuedResult.data) redirect('/federated-nodes?notice=' + encodeMessage('No queued operations available.'));

  const { data, error } = await supabase
    .from('federated_operations')
    .update({ status: 'running', node_id: nodeId, started_at: new Date().toISOString() })
    .eq('id', queuedResult.data.id)
    .eq('status', 'queued')
    .select('id')
    .single();

  if (error) redirect('/federated-nodes?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'federated_operation.claimed',
    entity: 'federated_operation',
    entityId: data.id,
    metadata: { orgId: orgContext.orgId, nodeId },
  });

  revalidatePath('/federated-nodes');
  redirect('/federated-nodes?notice=' + encodeMessage('Operation claimed and marked running.'));
}

export async function updateFederatedOperationStatusAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const operationId = String(formData.get('operationId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (!operationId || !status) redirect('/federated-nodes?error=' + encodeMessage('Missing operation update payload.'));

  const payload: Record<string, unknown> = { status };
  if (status === 'running') payload.started_at = new Date().toISOString();
  if (status === 'completed' || status === 'failed' || status === 'cancelled') payload.finished_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('federated_operations')
    .update(payload)
    .eq('id', operationId)
    .is('deleted_at', null)
    .select('id, org_id')
    .single();

  if (error) redirect('/federated-nodes?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'federated_operation.status_updated',
    entity: 'federated_operation',
    entityId: data.id,
    metadata: { orgId: data.org_id, status },
  });

  revalidatePath('/federated-nodes');
  redirect('/federated-nodes?notice=' + encodeMessage('Operation status updated.'));
}
