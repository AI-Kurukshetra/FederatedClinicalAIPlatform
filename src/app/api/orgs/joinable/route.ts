import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { createAdminClient } from '@/lib/supabase/admin';

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  deleted_at: string | null;
};

type MembershipRow = {
  org_id: string;
};

export async function GET() {
  const { user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const admin = createAdminClient();

  const [orgsResult, membershipsResult] = await Promise.all([
    admin.from('organizations').select('id, name, slug, deleted_at').is('deleted_at', null).order('name', { ascending: true }),
    admin
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .is('deleted_at', null),
  ]);

  if (orgsResult.error) {
    return fail({ code: 'ORG_JOINABLE_LIST_FAILED', message: orgsResult.error.message }, 400);
  }

  if (membershipsResult.error) {
    return fail({ code: 'ORG_MEMBERSHIP_LIST_FAILED', message: membershipsResult.error.message }, 400);
  }

  const memberships = (membershipsResult.data ?? []) as MembershipRow[];
  const joinedOrgIds = new Set(memberships.map((item) => item.org_id));
  const organizations = (orgsResult.data ?? []) as OrganizationRow[];

  const joinable = organizations
    .filter((org) => !joinedOrgIds.has(org.id))
    .map((org) => ({ id: org.id, name: org.name, slug: org.slug }));

  return ok(joinable);
}
