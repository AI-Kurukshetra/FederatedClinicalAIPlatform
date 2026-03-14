import { cookies } from 'next/headers';
import { ACTIVE_ORG_COOKIE } from '@/constants/cookies';

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => any;
  };
};

export async function getOrgMemberships(supabase: SupabaseLike, userId: string) {
  const { data } = await supabase
    .from('organization_members')
    .select('org_id, organizations(name)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .is('deleted_at', null);

  const rows = (data ?? []) as Array<{
    org_id: string;
    organizations?: { name?: string } | { name?: string }[] | null;
  }>;

  return rows.map((row) => {
    const orgNameRaw = row.organizations;
    const orgName = Array.isArray(orgNameRaw) ? orgNameRaw[0]?.name : orgNameRaw?.name;
    return {
      orgId: row.org_id,
      orgName: orgName ?? 'Organization',
    };
  });
}

export async function getPrimaryOrgContext(supabase: SupabaseLike, userId: string) {
  const memberships = await getOrgMemberships(supabase, userId);
  if (!memberships.length) return null;

  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  if (activeOrgId) {
    const matched = memberships.find((item) => item.orgId === activeOrgId);
    if (matched) return matched;
  }

  return memberships[0];
}
