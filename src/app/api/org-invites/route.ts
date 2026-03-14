import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { createOrgInviteSchema } from '@/lib/validations/org';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendOrganizationInviteEmailToAddress } from '@/lib/email/notifications';
import { writeAuditLog } from '@/server/services/audit';

const INVITE_TTL_DAYS = 7;

export async function POST(request: Request) {
  const { user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const body = await request.json().catch(() => null);
  const parsed = createOrgInviteSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: 'VALIDATION_ERROR', message: 'Invalid invite payload.', details: parsed.error.flatten() }, 422);
  }

  const admin = createAdminClient();
  const orgId = parsed.data.orgId;
  const inviteEmail = parsed.data.email.toLowerCase();

  const { data: permissionRow, error: permissionError } = await admin
    .from('organization_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .is('deleted_at', null)
    .in('role', ['owner', 'admin'])
    .maybeSingle();

  if (permissionError) {
    return fail({ code: 'ORG_INVITE_PERMISSION_CHECK_FAILED', message: permissionError.message }, 400);
  }

  if (!permissionRow) {
    return fail({ code: 'FORBIDDEN', message: 'Only organization owner/admin can invite members.' }, 403);
  }

  const { data: orgRow, error: orgError } = await admin
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .is('deleted_at', null)
    .maybeSingle();

  if (orgError) {
    return fail({ code: 'ORG_FETCH_FAILED', message: orgError.message }, 400);
  }

  if (!orgRow) {
    return fail({ code: 'ORG_NOT_FOUND', message: 'Organization was not found.' }, 404);
  }

  const token = `org_${crypto.randomUUID().replaceAll('-', '')}`;
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error: insertError } = await admin.from('invites').insert({
    org_id: orgId,
    email: inviteEmail,
    role: parsed.data.role,
    token,
    expires_at: expiresAt,
    invited_by: user.id,
  });

  if (insertError) {
    return fail({ code: 'ORG_INVITE_CREATE_FAILED', message: insertError.message }, 400);
  }

  const origin = new URL(request.url).origin;
  const inviteLink = `${origin}/join?token=${encodeURIComponent(token)}`;
  let emailSent = true;

  try {
    await sendOrganizationInviteEmailToAddress({
      to: inviteEmail,
      organizationName: orgRow.name,
      invitedByName: user.user_metadata?.full_name || user.email || 'A team member',
      inviteLink,
    });
  } catch {
    emailSent = false;
  }

  await writeAuditLog({
    actorId: user.id,
    action: 'organization_invite.created',
    entity: 'invites',
    entityId: token,
    metadata: {
      orgId,
      email: inviteEmail,
      role: parsed.data.role,
      emailSent,
      expiresAt,
    },
  });

  return ok({
    token,
    inviteLink,
    email: inviteEmail,
    role: parsed.data.role,
    expiresAt,
    organizationName: orgRow.name,
    emailSent,
  }, undefined, 201);
}
