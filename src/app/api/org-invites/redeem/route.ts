import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { redeemOrgInviteSchema } from '@/lib/validations/org';
import { createAdminClient } from '@/lib/supabase/admin';
import { ACTIVE_ORG_COOKIE } from '@/constants/cookies';
import { writeAuditLog } from '@/server/services/audit';

type InviteLookupRow = {
  id: string;
  org_id: string;
  email: string;
  role: 'admin' | 'researcher' | 'analyst' | 'member';
  token: string;
  expires_at: string;
  accepted_at: string | null;
  deleted_at: string | null;
  organizations?: { name?: string } | { name?: string }[] | null;
};

export async function POST(request: Request) {
  const { user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const body = await request.json().catch(() => null);
  const parsed = redeemOrgInviteSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: 'VALIDATION_ERROR', message: 'Invalid invite token.', details: parsed.error.flatten() }, 422);
  }

  const token = parsed.data.token;
  const userEmail = user.email?.toLowerCase();
  if (!userEmail) {
    return fail({ code: 'EMAIL_REQUIRED', message: 'Your account email is required to accept invites.' }, 400);
  }

  const admin = createAdminClient();
  const { data: rawInvite, error: inviteError } = await admin
    .from('invites')
    .select('id, org_id, email, role, token, expires_at, accepted_at, deleted_at, organizations(name)')
    .eq('token', token)
    .maybeSingle();

  if (inviteError) {
    return fail({ code: 'ORG_INVITE_LOOKUP_FAILED', message: inviteError.message }, 400);
  }

  const invite = rawInvite as InviteLookupRow | null;
  if (!invite || invite.deleted_at) {
    return fail({ code: 'ORG_INVITE_NOT_FOUND', message: 'Invite token is invalid.' }, 404);
  }

  if (invite.accepted_at) {
    return fail({ code: 'ORG_INVITE_ALREADY_ACCEPTED', message: 'Invite was already accepted.' }, 409);
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return fail({ code: 'ORG_INVITE_EXPIRED', message: 'Invite token has expired. Request a new invite.' }, 410);
  }

  if (invite.email.toLowerCase() !== userEmail) {
    return fail(
      { code: 'ORG_INVITE_EMAIL_MISMATCH', message: `Invite is for ${invite.email}. Sign in with that email to join.` },
      403
    );
  }

  const { error: profileError } = await admin.from('profiles').upsert(
    {
      id: user.id,
      email: user.email,
      full_name: typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null,
    },
    { onConflict: 'id' }
  );

  if (profileError) {
    return fail({ code: 'ORG_INVITE_PROFILE_SYNC_FAILED', message: profileError.message }, 400);
  }

  const { error: memberError } = await admin.from('organization_members').upsert(
    {
      org_id: invite.org_id,
      user_id: user.id,
      role: invite.role,
      status: 'active',
      joined_at: new Date().toISOString(),
      deleted_at: null,
    },
    { onConflict: 'org_id,user_id' }
  );

  if (memberError) {
    return fail({ code: 'ORG_INVITE_MEMBERSHIP_FAILED', message: memberError.message }, 400);
  }

  const { error: acceptedError } = await admin
    .from('invites')
    .update({ accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', invite.id)
    .is('accepted_at', null);

  if (acceptedError) {
    return fail({ code: 'ORG_INVITE_ACCEPT_MARK_FAILED', message: acceptedError.message }, 400);
  }

  const orgNameRaw = invite.organizations;
  const orgName = Array.isArray(orgNameRaw) ? orgNameRaw[0]?.name : orgNameRaw?.name;

  await writeAuditLog({
    actorId: user.id,
    action: 'organization_invite.accepted',
    entity: 'invites',
    entityId: invite.id,
    metadata: { orgId: invite.org_id, role: invite.role, email: userEmail },
  });

  const response = ok({
    orgId: invite.org_id,
    orgName: orgName ?? 'Organization',
    role: invite.role,
  });

  response.cookies.set({
    name: ACTIVE_ORG_COOKIE,
    value: invite.org_id,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
