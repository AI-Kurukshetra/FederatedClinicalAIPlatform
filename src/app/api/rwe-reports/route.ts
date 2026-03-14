import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { writeAuditLog } from '@/server/services/audit';

export async function GET(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const orgId = new URL(request.url).searchParams.get('orgId');
  if (!orgId) return fail({ code: 'VALIDATION_ERROR', message: 'orgId query param is required.' }, 422);

  const { data, error } = await supabase
    .from('rwe_reports')
    .select('id, org_id, study_id, report_name, report_type, status, generated_at, file_url, summary_json, created_by, created_at, updated_at')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return fail({ code: 'RWE_REPORT_LIST_FAILED', message: error.message }, 400);
  return ok(data);
}

export async function POST(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail({ code: 'VALIDATION_ERROR', message: 'Invalid report payload.' }, 422);

  const { orgId, studyId, reportName, reportType, status, generatedAt, fileUrl, summaryJson } = body as Record<string, unknown>;
  if (typeof orgId !== 'string' || typeof reportName !== 'string' || typeof reportType !== 'string') {
    return fail({ code: 'VALIDATION_ERROR', message: 'orgId, reportName, and reportType are required.' }, 422);
  }

  const { data, error } = await supabase
    .from('rwe_reports')
    .insert({
      org_id: orgId,
      study_id: typeof studyId === 'string' ? studyId : null,
      report_name: reportName,
      report_type: reportType,
      status: typeof status === 'string' ? status : 'draft',
      generated_at: typeof generatedAt === 'string' && generatedAt ? generatedAt : null,
      file_url: typeof fileUrl === 'string' ? fileUrl : null,
      summary_json: summaryJson && typeof summaryJson === 'object' ? summaryJson : {},
      created_by: user.id,
    })
    .select('id, org_id, report_name, report_type, status, generated_at, file_url, created_at')
    .single();

  if (error) return fail({ code: 'RWE_REPORT_CREATE_FAILED', message: error.message }, 400);

  await writeAuditLog({
    actorId: user.id,
    action: 'rwe_report.created',
    entity: 'rwe_report',
    entityId: data.id,
    metadata: { orgId: data.org_id, reportType: data.report_type, via: 'api' },
  });

  return ok(data, undefined, 201);
}
