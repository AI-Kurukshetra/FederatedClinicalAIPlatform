import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { writeAuditLog } from '@/server/services/audit';

export async function GET(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const orgId = new URL(request.url).searchParams.get('orgId');
  if (!orgId) return fail({ code: 'VALIDATION_ERROR', message: 'orgId query param is required.' }, 422);

  const { data, error } = await supabase
    .from('consent_records')
    .select('id, org_id, subject_ref, consent_type, status, effective_at, expires_at, evidence_ref, created_by, created_at')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return fail({ code: 'CONSENT_LIST_FAILED', message: error.message }, 400);
  return ok(data);
}

export async function POST(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail({ code: 'VALIDATION_ERROR', message: 'Invalid consent payload.' }, 422);

  const { orgId, subjectRef, consentType, status, expiresAt, evidenceRef } = body as Record<string, unknown>;
  if (typeof orgId !== 'string' || typeof subjectRef !== 'string') {
    return fail({ code: 'VALIDATION_ERROR', message: 'orgId and subjectRef are required.' }, 422);
  }

  const { data, error } = await supabase
    .from('consent_records')
    .insert({
      org_id: orgId,
      subject_ref: subjectRef,
      consent_type: typeof consentType === 'string' ? consentType : 'research',
      status: typeof status === 'string' ? status : 'granted',
      expires_at: typeof expiresAt === 'string' && expiresAt ? new Date(expiresAt).toISOString() : null,
      evidence_ref: typeof evidenceRef === 'string' ? evidenceRef : null,
      created_by: user.id,
    })
    .select('id, org_id, subject_ref, consent_type, status, created_at')
    .single();

  if (error) return fail({ code: 'CONSENT_CREATE_FAILED', message: error.message }, 400);

  await writeAuditLog({
    actorId: user.id,
    action: 'consent_record.created',
    entity: 'consent_record',
    entityId: data.id,
    metadata: { orgId: data.org_id, consentType: data.consent_type, via: 'api' },
  });

  return ok(data, undefined, 201);
}
