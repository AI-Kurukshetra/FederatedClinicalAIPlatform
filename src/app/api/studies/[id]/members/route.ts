import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { inviteStudyMemberSchema } from '@/lib/validations/study';
import { sendStudySharedEmail } from '@/lib/email/notifications';
import { writeAuditLog } from '@/server/services/audit';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, context: Params) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const { id } = await context.params;
  const { data, error } = await supabase
    .from('study_members')
    .select('study_id, user_id, role, added_at, created_at')
    .eq('study_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) return fail({ code: 'STUDY_MEMBERS_LIST_FAILED', message: error.message }, 400);
  return ok(data);
}

export async function POST(request: Request, context: Params) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = inviteStudyMemberSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: 'VALIDATION_ERROR', message: 'Invalid study member payload.', details: parsed.error.flatten() }, 422);
  }

  const { data: studyData } = await supabase
    .from('studies')
    .select('id, name, org_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (!studyData) {
    return fail({ code: 'STUDY_NOT_FOUND', message: 'Study not found.' }, 404);
  }

  const { data: orgData } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', studyData.org_id)
    .is('deleted_at', null)
    .single();

  const { data, error } = await supabase
    .from('study_members')
    .insert({
      study_id: id,
      user_id: parsed.data.userId,
      role: parsed.data.role,
    })
    .select('study_id, user_id, role, added_at, created_at')
    .single();

  if (error) return fail({ code: 'STUDY_MEMBER_CREATE_FAILED', message: error.message }, 400);

  await writeAuditLog({
    actorId: user.id,
    action: 'study_member.added',
    entity: 'study_member',
    entityId: `${data.study_id}:${data.user_id}`,
    metadata: { studyId: data.study_id, userId: data.user_id, role: data.role },
  });

  // Non-blocking email notification after successful study sharing.
  const origin = new URL(request.url).origin;
  const sharedByName = user.user_metadata?.full_name || user.email || 'A team member';
  sendStudySharedEmail({
    invitedUserId: parsed.data.userId,
    studyName: studyData.name,
    organizationName: orgData?.name ?? 'your organization',
    sharedByName,
    studyLink: `${origin}/studies/${studyData.id}`,
  }).catch(() => null);

  return ok(data, undefined, 201);
}
