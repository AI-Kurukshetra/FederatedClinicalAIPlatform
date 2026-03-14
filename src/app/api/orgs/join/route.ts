import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { quickJoinOrganizationSchema } from '@/lib/validations/org';
import { ACTIVE_ORG_COOKIE } from '@/constants/cookies';

export async function POST(request: Request) {
  const { user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const body = await request.json().catch(() => null);
  const parsed = quickJoinOrganizationSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: 'VALIDATION_ERROR', message: 'Invalid organization payload.', details: parsed.error.flatten() }, 422);
  }

  const admin = createAdminClient();
  const orgId = parsed.data.orgId;

  const { data: orgRow, error: orgError } = await admin
    .from('organizations')
    .select('id, name, deleted_at')
    .eq('id', orgId)
    .is('deleted_at', null)
    .maybeSingle();

  if (orgError) {
    return fail({ code: 'ORG_JOIN_LOOKUP_FAILED', message: orgError.message }, 400);
  }

  if (!orgRow) {
    return fail({ code: 'ORG_NOT_FOUND', message: 'Organization not found.' }, 404);
  }

  const { error: profileError } = await admin.from('profiles').upsert(
    {
      id: user.id,
      email: user.email ?? null,
      full_name: typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null,
    },
    { onConflict: 'id' }
  );

  if (profileError) {
    return fail({ code: 'ORG_JOIN_PROFILE_SYNC_FAILED', message: profileError.message }, 400);
  }

  const now = new Date().toISOString();
  const { error: membershipError } = await admin.from('organization_members').upsert(
    {
      org_id: orgId,
      user_id: user.id,
      role: 'member',
      status: 'active',
      joined_at: now,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
    { onConflict: 'org_id,user_id' }
  );

  if (membershipError) {
    return fail({ code: 'ORG_JOIN_FAILED', message: membershipError.message }, 400);
  }

  const response = ok({ orgId: orgRow.id, orgName: orgRow.name, role: 'member' }, undefined, 201);
  response.cookies.set({
    name: ACTIVE_ORG_COOKIE,
    value: orgId,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
