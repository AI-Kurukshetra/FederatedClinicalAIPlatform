'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { encodeMessage } from '@/lib/auth/messages';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getPrimaryOrgContext } from '@/server/services/org-context';
import { writeAuditLog } from '@/server/services/audit';

export async function createRweReportAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const orgContext = await getPrimaryOrgContext(supabase, user.id);
  if (!orgContext) redirect('/reports?error=' + encodeMessage('No organization found for your account.'));

  const reportName = String(formData.get('reportName') ?? '').trim();
  const reportType = String(formData.get('reportType') ?? 'outcomes').trim();
  const studyId = String(formData.get('studyId') ?? '').trim();

  if (!reportName) redirect('/reports?error=' + encodeMessage('Report name is required.'));

  const { data, error } = await supabase
    .from('rwe_reports')
    .insert({
      org_id: orgContext.orgId,
      study_id: studyId || null,
      report_name: reportName,
      report_type: reportType,
      status: 'running',
      generated_at: new Date().toISOString(),
      file_url: null,
      summary_json: { generatedBy: 'createRweReportAction' },
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) redirect('/reports?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'rwe_report.created',
    entity: 'rwe_report',
    entityId: data.id,
    metadata: { orgId: orgContext.orgId, reportType, studyId: studyId || null },
  });

  revalidatePath('/reports');
  redirect('/reports?notice=' + encodeMessage('Report generation started.'));
}

export async function updateRweReportStatusAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const id = String(formData.get('id') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (!id || !status) redirect('/reports?error=' + encodeMessage('Missing report status payload.'));

  const fileUrl = status === 'ready' ? `https://example-reports.local/${id}.pdf` : null;

  const { data, error } = await supabase
    .from('rwe_reports')
    .update({ status, file_url: fileUrl })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, org_id, status')
    .single();

  if (error) redirect('/reports?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'rwe_report.status_updated',
    entity: 'rwe_report',
    entityId: data.id,
    metadata: { orgId: data.org_id, status: data.status },
  });

  revalidatePath('/reports');
  redirect('/reports?notice=' + encodeMessage('Report status updated.'));
}
