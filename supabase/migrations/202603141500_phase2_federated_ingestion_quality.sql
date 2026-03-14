-- 202603141500_phase2_federated_ingestion_quality.sql
-- Phase 2 schema: federated nodes, ingestion jobs, and data quality metrics.

create table if not exists public.federated_nodes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  region text not null,
  endpoint_url text,
  status text not null default 'online',
  capabilities jsonb not null default '{}'::jsonb,
  last_heartbeat_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (org_id, slug),
  constraint federated_nodes_name_len check (char_length(name) between 2 and 180),
  constraint federated_nodes_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint federated_nodes_status_check check (status in ('online', 'degraded', 'offline', 'maintenance'))
);

create table if not exists public.ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  node_id uuid references public.federated_nodes(id) on delete set null,
  source_name text not null,
  source_type text not null,
  status text not null default 'queued',
  records_processed bigint,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  triggered_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint ingestion_jobs_source_name_len check (char_length(source_name) between 2 and 180),
  constraint ingestion_jobs_source_type_check check (source_type in ('ehr', 'pacs', 'lab', 'notes', 'claims', 'fhir', 'other')),
  constraint ingestion_jobs_status_check check (status in ('queued', 'running', 'completed', 'failed')),
  constraint ingestion_jobs_records_processed_nonneg check (records_processed is null or records_processed >= 0)
);

create table if not exists public.data_quality_metrics (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  source_name text not null,
  metric_name text not null,
  metric_value numeric(7,2) not null,
  status text not null default 'good',
  details jsonb not null default '{}'::jsonb,
  measured_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint data_quality_metrics_source_name_len check (char_length(source_name) between 2 and 180),
  constraint data_quality_metrics_metric_name_len check (char_length(metric_name) between 2 and 180),
  constraint data_quality_metrics_value_range check (metric_value >= 0 and metric_value <= 100),
  constraint data_quality_metrics_status_check check (status in ('good', 'warning', 'critical'))
);

create index if not exists idx_federated_nodes_org_status
  on public.federated_nodes(org_id, status)
  where deleted_at is null;

create index if not exists idx_ingestion_jobs_org_status_created
  on public.ingestion_jobs(org_id, status, created_at desc)
  where deleted_at is null;

create index if not exists idx_ingestion_jobs_source_name_created
  on public.ingestion_jobs(source_name, created_at desc)
  where deleted_at is null;

create index if not exists idx_data_quality_metrics_org_measured
  on public.data_quality_metrics(org_id, measured_at desc)
  where deleted_at is null;

create index if not exists idx_data_quality_metrics_source_measured
  on public.data_quality_metrics(source_name, measured_at desc)
  where deleted_at is null;

drop trigger if exists set_federated_nodes_updated_at on public.federated_nodes;
create trigger set_federated_nodes_updated_at
before update on public.federated_nodes
for each row
execute function public.set_updated_at();

drop trigger if exists set_ingestion_jobs_updated_at on public.ingestion_jobs;
create trigger set_ingestion_jobs_updated_at
before update on public.ingestion_jobs
for each row
execute function public.set_updated_at();

drop trigger if exists set_data_quality_metrics_updated_at on public.data_quality_metrics;
create trigger set_data_quality_metrics_updated_at
before update on public.data_quality_metrics
for each row
execute function public.set_updated_at();

alter table public.federated_nodes enable row level security;
alter table public.ingestion_jobs enable row level security;
alter table public.data_quality_metrics enable row level security;

create policy "federated_nodes_select_member"
  on public.federated_nodes
  for select
  to authenticated
  using (public.is_org_member(org_id));

create policy "federated_nodes_insert_member"
  on public.federated_nodes
  for insert
  to authenticated
  with check (public.is_org_member(org_id) and created_by = auth.uid());

create policy "federated_nodes_update_admin_owner_or_creator"
  on public.federated_nodes
  for update
  to authenticated
  using (public.is_org_admin_or_owner(org_id) or created_by = auth.uid())
  with check (public.is_org_admin_or_owner(org_id) or created_by = auth.uid());

create policy "ingestion_jobs_select_member"
  on public.ingestion_jobs
  for select
  to authenticated
  using (public.is_org_member(org_id));

create policy "ingestion_jobs_insert_member"
  on public.ingestion_jobs
  for insert
  to authenticated
  with check (public.is_org_member(org_id) and triggered_by = auth.uid());

create policy "ingestion_jobs_update_member"
  on public.ingestion_jobs
  for update
  to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "data_quality_metrics_select_member"
  on public.data_quality_metrics
  for select
  to authenticated
  using (public.is_org_member(org_id));

create policy "data_quality_metrics_insert_member"
  on public.data_quality_metrics
  for insert
  to authenticated
  with check (public.is_org_member(org_id) and created_by = auth.uid());

create policy "data_quality_metrics_update_admin_owner_or_creator"
  on public.data_quality_metrics
  for update
  to authenticated
  using (public.is_org_admin_or_owner(org_id) or created_by = auth.uid())
  with check (public.is_org_admin_or_owner(org_id) or created_by = auth.uid());
