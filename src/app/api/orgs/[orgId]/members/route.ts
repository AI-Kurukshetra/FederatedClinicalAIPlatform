import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { inviteMemberSchema } from '@/lib/validations/org';
import { sendOrganizationInviteEmail } from '@/lib/email/notifications';
import { writeAuditLog } from '@/server/services/audit';

interface Params {
  params: Promise<{ orgId: string }>;
}

export async function GET(_: Request, context: Params) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const { orgId } = await context.params;
  const { data, error } = await supabase
    .from('organization_members')
    .select('org_id, user_id, role, status, joined_at, created_at')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) return fail({ code: 'ORG_MEMBERS_LIST_FAILED', message: error.message }, 400);
  return ok(data);
}

export async function POST(request: Request, context: Params) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const { orgId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = inviteMemberSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: 'VALIDATION_ERROR', message: 'Invalid member payload.', details: parsed.error.flatten() }, 422);
  }

  const { data: orgData } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .is('deleted_at', null)
    .single();

  const { data, error } = await supabase
    .from('organization_members')
    .insert({
      org_id: orgId,
      user_id: parsed.data.userId,
      role: parsed.data.role,
      status: parsed.data.status,
    })
    .select('org_id, user_id, role, status, joined_at, created_at')
    .single();

  if (error) return fail({ code: 'ORG_MEMBER_CREATE_FAILED', message: error.message }, 400);

  await writeAuditLog({
    actorId: user.id,
    action: 'organization_member.added',
    entity: 'organization_member',
    entityId: `${data.org_id}:${data.user_id}`,
    metadata: { orgId: data.org_id, userId: data.user_id, role: data.role, status: data.status },
  });

  // Non-blocking email notification after successful membership insert.
  const origin = new URL(request.url).origin;
  const inviterName = user.user_metadata?.full_name || user.email || 'A team member';
  const orgName = orgData?.name ?? 'your organization';
  sendOrganizationInviteEmail({
    invitedUserId: parsed.data.userId,
    organizationName: orgName,
    invitedByName: inviterName,
    inviteLink: `${origin}/dashboard`,
  }).catch(() => null);

  return ok(data, undefined, 201);
}
