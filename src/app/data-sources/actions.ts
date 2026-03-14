'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { encodeMessage } from '@/lib/auth/messages';
import { getPrimaryOrgContext } from '@/server/services/org-context';
import { writeAuditLog } from '@/server/services/audit';

export async function createIngestionJobAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const orgContext = await getPrimaryOrgContext(supabase, user.id);
  if (!orgContext) redirect('/data-sources?error=' + encodeMessage('No organization found for your account.'));

  const sourceName = String(formData.get('sourceName') ?? '').trim();
  const sourceType = String(formData.get('sourceType') ?? 'ehr');
  const status = String(formData.get('status') ?? 'queued');
  const recordsProcessedRaw = String(formData.get('recordsProcessed') ?? '').trim();
  const recordsProcessed = recordsProcessedRaw ? Number(recordsProcessedRaw) : null;

  if (!sourceName) redirect('/data-sources?error=' + encodeMessage('Source name is required.'));
  if (recordsProcessedRaw && Number.isNaN(recordsProcessed)) {
    redirect('/data-sources?error=' + encodeMessage('recordsProcessed must be numeric.'));
  }

  const { data, error } = await supabase
    .from('ingestion_jobs')
    .insert({
      org_id: orgContext.orgId,
      source_name: sourceName,
      source_type: sourceType,
      status,
      records_processed: recordsProcessed,
      triggered_by: user.id,
      started_at: new Date().toISOString(),
      finished_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (error) redirect('/data-sources?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'ingestion_job.created',
    entity: 'ingestion_job',
    entityId: data?.id,
    metadata: { orgId: orgContext.orgId, sourceName, sourceType, status },
  });

  revalidatePath('/data-sources');
  revalidatePath('/analytics');
  redirect('/data-sources?notice=' + encodeMessage('Ingestion job created.'));
}

export async function createDataQualityMetricAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const orgContext = await getPrimaryOrgContext(supabase, user.id);
  if (!orgContext) redirect('/data-sources?error=' + encodeMessage('No organization found for your account.'));

  const sourceName = String(formData.get('sourceName') ?? '').trim();
  const metricName = String(formData.get('metricName') ?? '').trim();
  const metricValueRaw = String(formData.get('metricValue') ?? '').trim();
  const status = String(formData.get('status') ?? 'good');
  const metricValue = Number(metricValueRaw);

  if (!sourceName || !metricName || !metricValueRaw) {
    redirect('/data-sources?error=' + encodeMessage('Source, metric name, and metric value are required.'));
  }
  if (Number.isNaN(metricValue) || metricValue < 0 || metricValue > 100) {
    redirect('/data-sources?error=' + encodeMessage('metricValue must be a number between 0 and 100.'));
  }

  const { data, error } = await supabase
    .from('data_quality_metrics')
    .insert({
      org_id: orgContext.orgId,
      source_name: sourceName,
      metric_name: metricName,
      metric_value: metricValue,
      status,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) redirect('/data-sources?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'data_quality_metric.created',
    entity: 'data_quality_metric',
    entityId: data?.id,
    metadata: { orgId: orgContext.orgId, sourceName, metricName, metricValue, status },
  });

  revalidatePath('/data-sources');
  redirect('/data-sources?notice=' + encodeMessage('Data quality metric added.'));
}

export async function runQualityScanAction() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const orgContext = await getPrimaryOrgContext(supabase, user.id);
  if (!orgContext) redirect('/data-sources?error=' + encodeMessage('No organization found for your account.'));

  const { data: jobs } = await supabase
    .from('ingestion_jobs')
    .select('source_name, status')
    .eq('org_id', orgContext.orgId)
    .is('deleted_at', null);

  const bySource = new Map<string, { total: number; completed: number }>();
  for (const job of jobs ?? []) {
    const current = bySource.get(job.source_name) ?? { total: 0, completed: 0 };
    current.total += 1;
    if (job.status === 'completed') current.completed += 1;
    bySource.set(job.source_name, current);
  }

  let inserted = 0;
  for (const [sourceName, counts] of bySource.entries()) {
    const score = Number(((counts.completed / Math.max(1, counts.total)) * 100).toFixed(2));
    const status = score >= 90 ? 'good' : score >= 70 ? 'warning' : 'critical';
    const { error } = await supabase.from('data_quality_metrics').insert({
      org_id: orgContext.orgId,
      source_name: sourceName,
      metric_name: 'auto_quality_scan',
      metric_value: score,
      status,
      details: { totalJobs: counts.total, completedJobs: counts.completed, generatedBy: 'runQualityScanAction' },
      created_by: user.id,
    });
    if (!error) inserted += 1;
  }

  await writeAuditLog({
    actorId: user.id,
    action: 'data_quality.scan_run',
    entity: 'data_quality_metric',
    metadata: { orgId: orgContext.orgId, metricsInserted: inserted },
  });

  revalidatePath('/data-sources');
  revalidatePath('/analytics');
  redirect('/data-sources?notice=' + encodeMessage(`Quality scan completed. ${inserted} metric(s) created.`));
}

export async function archiveIngestionJobAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/data-sources?error=' + encodeMessage('Missing ingestion job id.'));

  const { data, error } = await supabase
    .from('ingestion_jobs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, org_id')
    .single();

  if (error) redirect('/data-sources?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'ingestion_job.archived',
    entity: 'ingestion_job',
    entityId: data.id,
    metadata: { orgId: data.org_id },
  });

  revalidatePath('/data-sources');
  revalidatePath('/analytics');
  redirect('/data-sources?notice=' + encodeMessage('Ingestion job archived.'));
}

export async function restoreIngestionJobAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/data-sources?error=' + encodeMessage('Missing ingestion job id.'));

  const { data, error } = await supabase
    .from('ingestion_jobs')
    .update({ deleted_at: null })
    .eq('id', id)
    .not('deleted_at', 'is', null)
    .select('id, org_id')
    .single();

  if (error) redirect('/data-sources?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'ingestion_job.restored',
    entity: 'ingestion_job',
    entityId: data.id,
    metadata: { orgId: data.org_id },
  });

  revalidatePath('/data-sources');
  revalidatePath('/analytics');
  redirect('/data-sources?notice=' + encodeMessage('Ingestion job restored.'));
}

export async function archiveDataQualityMetricAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/data-sources?error=' + encodeMessage('Missing quality metric id.'));

  const { data, error } = await supabase
    .from('data_quality_metrics')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, org_id')
    .single();

  if (error) redirect('/data-sources?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'data_quality_metric.archived',
    entity: 'data_quality_metric',
    entityId: data.id,
    metadata: { orgId: data.org_id },
  });

  revalidatePath('/data-sources');
  revalidatePath('/analytics');
  redirect('/data-sources?notice=' + encodeMessage('Data quality metric archived.'));
}

export async function restoreDataQualityMetricAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/data-sources?error=' + encodeMessage('Missing quality metric id.'));

  const { data, error } = await supabase
    .from('data_quality_metrics')
    .update({ deleted_at: null })
    .eq('id', id)
    .not('deleted_at', 'is', null)
    .select('id, org_id')
    .single();

  if (error) redirect('/data-sources?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'data_quality_metric.restored',
    entity: 'data_quality_metric',
    entityId: data.id,
    metadata: { orgId: data.org_id },
  });

  revalidatePath('/data-sources');
  revalidatePath('/analytics');
  redirect('/data-sources?notice=' + encodeMessage('Data quality metric restored.'));
}

export async function createConnectorConfigAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const orgContext = await getPrimaryOrgContext(supabase, user.id);
  if (!orgContext) redirect('/data-sources?error=' + encodeMessage('No organization found for your account.'));

  const name = String(formData.get('name') ?? '').trim();
  const sourceType = String(formData.get('sourceType') ?? 'ehr').trim();
  const status = String(formData.get('status') ?? 'active').trim();
  const scheduleCron = String(formData.get('scheduleCron') ?? '').trim();
  const configJsonRaw = String(formData.get('configJson') ?? '').trim();
  const nodeId = String(formData.get('nodeId') ?? '').trim();

  if (!name) redirect('/data-sources?error=' + encodeMessage('Connector name is required.'));

  let configJson: Record<string, unknown> = {};
  if (configJsonRaw) {
    try {
      const parsed = JSON.parse(configJsonRaw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error();
      configJson = parsed as Record<string, unknown>;
    } catch {
      redirect('/data-sources?error=' + encodeMessage('Connector config JSON must be a valid object.'));
    }
  }

  const { data, error } = await supabase
    .from('connector_configs')
    .insert({
      org_id: orgContext.orgId,
      node_id: nodeId || null,
      name,
      source_type: sourceType,
      status,
      schedule_cron: scheduleCron || null,
      config_json: configJson,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) redirect('/data-sources?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'connector_config.created',
    entity: 'connector_config',
    entityId: data.id,
    metadata: { orgId: orgContext.orgId, sourceType, status },
  });

  revalidatePath('/data-sources');
  redirect('/data-sources?notice=' + encodeMessage('Connector config created.'));
}

export async function updateConnectorStatusAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const id = String(formData.get('id') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (!id || !status) redirect('/data-sources?error=' + encodeMessage('Missing connector status payload.'));

  const { data, error } = await supabase
    .from('connector_configs')
    .update({ status })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, org_id, status')
    .single();

  if (error) redirect('/data-sources?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'connector_config.status_updated',
    entity: 'connector_config',
    entityId: data.id,
    metadata: { orgId: data.org_id, status: data.status },
  });

  revalidatePath('/data-sources');
  redirect('/data-sources?notice=' + encodeMessage('Connector status updated.'));
}

export async function createQualityRuleAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const orgContext = await getPrimaryOrgContext(supabase, user.id);
  if (!orgContext) redirect('/data-sources?error=' + encodeMessage('No organization found for your account.'));

  const ruleName = String(formData.get('ruleName') ?? '').trim();
  const metricName = String(formData.get('metricName') ?? '').trim();
  const thresholdRaw = String(formData.get('threshold') ?? '').trim();
  const comparator = String(formData.get('comparator') ?? 'gte').trim();
  const severity = String(formData.get('severity') ?? 'warning').trim();
  const connectorId = String(formData.get('connectorId') ?? '').trim();
  const threshold = Number(thresholdRaw);

  if (!ruleName || !metricName || Number.isNaN(threshold)) {
    redirect('/data-sources?error=' + encodeMessage('Rule name, metric name, and numeric threshold are required.'));
  }

  const { data, error } = await supabase
    .from('quality_rules')
    .insert({
      org_id: orgContext.orgId,
      connector_id: connectorId || null,
      rule_name: ruleName,
      metric_name: metricName,
      threshold,
      comparator,
      severity,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) redirect('/data-sources?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'quality_rule.created',
    entity: 'quality_rule',
    entityId: data.id,
    metadata: { orgId: orgContext.orgId, metricName, threshold, comparator, severity },
  });

  revalidatePath('/data-sources');
  redirect('/data-sources?notice=' + encodeMessage('Quality rule created.'));
}

export async function toggleQualityRuleAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const id = String(formData.get('id') ?? '').trim();
  const isActive = String(formData.get('isActive') ?? '').trim() === '1';
  if (!id) redirect('/data-sources?error=' + encodeMessage('Missing quality rule id.'));

  const { data, error } = await supabase
    .from('quality_rules')
    .update({ is_active: isActive })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, org_id, is_active')
    .single();

  if (error) redirect('/data-sources?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'quality_rule.toggled',
    entity: 'quality_rule',
    entityId: data.id,
    metadata: { orgId: data.org_id, isActive: data.is_active },
  });

  revalidatePath('/data-sources');
  redirect('/data-sources?notice=' + encodeMessage('Quality rule updated.'));
}
