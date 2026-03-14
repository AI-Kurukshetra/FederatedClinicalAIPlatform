-- 202603141230_phase1_org_studies_cohorts.sql
-- Phase 1 schema: organizations, membership, studies, cohorts, and execution tracking.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint organizations_name_len check (char_length(name) between 2 and 120),
  constraint organizations_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (org_id, user_id),
  constraint organization_members_role_check check (role in ('owner', 'admin', 'researcher', 'analyst', 'member')),
  constraint organization_members_status_check check (status in ('active', 'invited', 'disabled'))
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint invites_role_check check (role in ('admin', 'researcher', 'analyst', 'member'))
);

create index if not exists idx_org_members_user_id on public.organization_members(user_id);
create index if not exists idx_invites_org_id_email on public.invites(org_id, email);
create index if not exists idx_invites_expires_at on public.invites(expires_at);

create table if not exists public.studies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft',
  owner_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint studies_name_len check (char_length(name) between 3 and 180),
  constraint studies_status_check check (status in ('draft', 'active', 'paused', 'completed', 'archived'))
);

create table if not exists public.study_members (
  study_id uuid not null references public.studies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'viewer',
  added_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (study_id, user_id),
  constraint study_members_role_check check (role in ('owner', 'editor', 'viewer'))
);

create table if not exists public.study_activity (
  id bigint generated always as identity primary key,
  study_id uuid not null references public.studies(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_studies_org_id on public.studies(org_id);
create index if not exists idx_study_members_user_id on public.study_members(user_id);
create index if not exists idx_study_activity_study_id_created_at on public.study_activity(study_id, created_at desc);

create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid references public.studies(id) on delete set null,
  name text not null,
  description text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint cohorts_name_len check (char_length(name) between 3 and 180)
);

create table if not exists public.cohort_versions (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  version_no int not null,
  definition_json jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (cohort_id, version_no)
);

create table if not exists public.cohort_runs (
  id uuid primary key default gen_random_uuid(),
  cohort_version_id uuid not null references public.cohort_versions(id) on delete cascade,
  status text not null default 'queued',
  result_count int,
  executed_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cohort_runs_status_check check (status in ('queued', 'running', 'completed', 'failed'))
);

create index if not exists idx_cohorts_org_id on public.cohorts(org_id);
create index if not exists idx_cohorts_study_id on public.cohorts(study_id);
create index if not exists idx_cohort_versions_cohort_id on public.cohort_versions(cohort_id);
create index if not exists idx_cohort_runs_version_id on public.cohort_runs(cohort_version_id);
create index if not exists idx_cohort_runs_status on public.cohort_runs(status);

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at
before update on public.organizations
for each row
execute function public.set_updated_at();

drop trigger if exists set_organization_members_updated_at on public.organization_members;
create trigger set_organization_members_updated_at
before update on public.organization_members
for each row
execute function public.set_updated_at();

drop trigger if exists set_invites_updated_at on public.invites;
create trigger set_invites_updated_at
before update on public.invites
for each row
execute function public.set_updated_at();

drop trigger if exists set_studies_updated_at on public.studies;
create trigger set_studies_updated_at
before update on public.studies
for each row
execute function public.set_updated_at();

drop trigger if exists set_study_members_updated_at on public.study_members;
create trigger set_study_members_updated_at
before update on public.study_members
for each row
execute function public.set_updated_at();

drop trigger if exists set_cohorts_updated_at on public.cohorts;
create trigger set_cohorts_updated_at
before update on public.cohorts
for each row
execute function public.set_updated_at();

drop trigger if exists set_cohort_runs_updated_at on public.cohort_runs;
create trigger set_cohort_runs_updated_at
before update on public.cohort_runs
for each row
execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.invites enable row level security;
alter table public.studies enable row level security;
alter table public.study_members enable row level security;
alter table public.study_activity enable row level security;
alter table public.cohorts enable row level security;
alter table public.cohort_versions enable row level security;
alter table public.cohort_runs enable row level security;

create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
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

create policy "organizations_select_member"
  on public.organizations
  for select
  to authenticated
  using (public.is_org_member(id));

create policy "organizations_insert_self_owner"
  on public.organizations
  for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "organizations_update_admin_owner"
  on public.organizations
  for update
  to authenticated
  using (public.is_org_admin_or_owner(id))
  with check (public.is_org_admin_or_owner(id));

create policy "org_members_select_member"
  on public.organization_members
  for select
  to authenticated
  using (public.is_org_member(org_id));

create policy "org_members_insert_admin_owner"
  on public.organization_members
  for insert
  to authenticated
  with check (public.is_org_admin_or_owner(org_id));

create policy "org_members_update_admin_owner"
  on public.organization_members
  for update
  to authenticated
  using (public.is_org_admin_or_owner(org_id))
  with check (public.is_org_admin_or_owner(org_id));

create policy "invites_select_member"
  on public.invites
  for select
  to authenticated
  using (public.is_org_member(org_id));

create policy "invites_write_admin_owner"
  on public.invites
  for all
  to authenticated
  using (public.is_org_admin_or_owner(org_id))
  with check (public.is_org_admin_or_owner(org_id));

create policy "studies_select_member"
  on public.studies
  for select
  to authenticated
  using (public.is_org_member(org_id));

create policy "studies_insert_member"
  on public.studies
  for insert
  to authenticated
  with check (public.is_org_member(org_id) and owner_id = auth.uid());

create policy "studies_update_admin_owner"
  on public.studies
  for update
  to authenticated
  using (public.is_org_admin_or_owner(org_id) or owner_id = auth.uid())
  with check (public.is_org_admin_or_owner(org_id) or owner_id = auth.uid());

create policy "study_members_select_org_member"
  on public.study_members
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.studies s
      where s.id = study_id
        and public.is_org_member(s.org_id)
    )
  );

create policy "study_members_write_study_owner_or_org_admin"
  on public.study_members
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.studies s
      where s.id = study_id
        and (public.is_org_admin_or_owner(s.org_id) or s.owner_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.studies s
      where s.id = study_id
        and (public.is_org_admin_or_owner(s.org_id) or s.owner_id = auth.uid())
    )
  );

create policy "study_activity_select_org_member"
  on public.study_activity
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.studies s
      where s.id = study_id
        and public.is_org_member(s.org_id)
    )
  );

create policy "study_activity_insert_org_member"
  on public.study_activity
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.studies s
      where s.id = study_id
        and public.is_org_member(s.org_id)
    )
  );

create policy "cohorts_select_member"
  on public.cohorts
  for select
  to authenticated
  using (public.is_org_member(org_id));

create policy "cohorts_insert_member"
  on public.cohorts
  for insert
  to authenticated
  with check (public.is_org_member(org_id) and created_by = auth.uid());

create policy "cohorts_update_admin_owner_creator"
  on public.cohorts
  for update
  to authenticated
  using (public.is_org_admin_or_owner(org_id) or created_by = auth.uid())
  with check (public.is_org_admin_or_owner(org_id) or created_by = auth.uid());

create policy "cohort_versions_select_member"
  on public.cohort_versions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.cohorts c
      where c.id = cohort_id
        and public.is_org_member(c.org_id)
    )
  );

create policy "cohort_versions_insert_member"
  on public.cohort_versions
  for insert
  to authenticated
  with check (
    created_by = auth.uid() and
    exists (
      select 1
      from public.cohorts c
      where c.id = cohort_id
        and public.is_org_member(c.org_id)
    )
  );

create policy "cohort_runs_select_member"
  on public.cohort_runs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.cohort_versions cv
      join public.cohorts c on c.id = cv.cohort_id
      where cv.id = cohort_version_id
        and public.is_org_member(c.org_id)
    )
  );

create policy "cohort_runs_insert_member"
  on public.cohort_runs
  for insert
  to authenticated
  with check (
    created_by = auth.uid() and
    exists (
      select 1
      from public.cohort_versions cv
      join public.cohorts c on c.id = cv.cohort_id
      where cv.id = cohort_version_id
        and public.is_org_member(c.org_id)
    )
  );

create policy "cohort_runs_update_member"
  on public.cohort_runs
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.cohort_versions cv
      join public.cohorts c on c.id = cv.cohort_id
      where cv.id = cohort_version_id
        and public.is_org_member(c.org_id)
    )
  )
  with check (
    exists (
      select 1
      from public.cohort_versions cv
      join public.cohorts c on c.id = cv.cohort_id
      where cv.id = cohort_version_id
        and public.is_org_member(c.org_id)
    )
  );



