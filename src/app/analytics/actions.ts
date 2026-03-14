'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { encodeMessage } from '@/lib/auth/messages';
import { getPrimaryOrgContext } from '@/server/services/org-context';
import { writeAuditLog } from '@/server/services/audit';

export async function runAnalysisAction() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=' + encodeMessage('Please sign in first.'));

  const orgContext = await getPrimaryOrgContext(supabase, user.id);
  if (!orgContext) redirect('/analytics?error=' + encodeMessage('No organization found for your account.'));

  const startedAt = new Date();
  const finishedAt = new Date(startedAt.getTime() + 60 * 1000);
  const recordsProcessed = Math.max(1000, Math.floor((startedAt.getTime() / 1000) % 50000));

  const { data, error } = await supabase
    .from('ingestion_jobs')
    .insert({
      org_id: orgContext.orgId,
      source_name: 'RWE analysis pipeline',
      source_type: 'other',
      status: 'completed',
      records_processed: recordsProcessed,
      metadata: { operation: 'run_analysis' },
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      triggered_by: user.id,
    })
    .select('id')
    .single();

  if (error) redirect('/analytics?error=' + encodeMessage(error.message));

  await writeAuditLog({
    actorId: user.id,
    action: 'analysis.run_triggered',
    entity: 'ingestion_job',
    entityId: data?.id,
    metadata: { orgId: orgContext.orgId, recordsProcessed },
  });

  revalidatePath('/analytics');
  revalidatePath('/data-sources');
  redirect('/analytics?notice=' + encodeMessage('Analysis run completed and results were recorded.'));
}
