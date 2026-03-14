-- 202603142030_fix_org_membership_rls.sql
-- Fix org membership visibility by avoiding recursive RLS evaluation in helper functions.

create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.org_id = p_org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.deleted_at is null
  );
$$;

create or replace function public.is_org_admin_or_owner(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.org_id = p_org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.deleted_at is null
      and om.role in ('owner', 'admin')
  );
$$;

drop policy if exists "org_members_select_member" on public.organization_members;
create policy "org_members_select_member"
  on public.organization_members
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_org_member(org_id));
