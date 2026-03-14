-- 202603141700_phase3_workflows_compliance_trials_reports.sql
-- Phase 3 schema: orchestration workflows, connector configs, quality rules,
-- consent/policy management, trial matching, and RWE report artifacts.

create table if not exists public.federated_operations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  node_id uuid references public.federated_nodes(id) on delete set null,
  operation_type text not null,
  status text not null default 'queued',
  priority int not null default 50,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_message text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint federated_operations_type_check check (operation_type in ('connectivity_check', 'quality_scan', 'cohort_run', 'analysis_run')),
  constraint federated_operations_status_check check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  constraint federated_operations_priority_check check (priority between 1 and 100)
);

create table if not exists public.connector_configs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  node_id uuid references public.federated_nodes(id) on delete set null,
  name text not null,
  source_type text not null,
  status text not null default 'active',
  schedule_cron text,
  config_json jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint connector_configs_name_len check (char_length(name) between 2 and 180),
  constraint connector_configs_source_type_check check (source_type in ('ehr', 'pacs', 'lab', 'notes', 'claims', 'fhir', 'omics', 'other')),
  constraint connector_configs_status_check check (status in ('active', 'paused', 'failed', 'archived'))
);

create table if not exists public.quality_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  connector_id uuid references public.connector_configs(id) on delete set null,
  rule_name text not null,
  metric_name text not null,
  threshold numeric(7,2) not null,
  comparator text not null default 'gte',
  severity text not null default 'warning',
  is_active boolean not null default true,
  rule_json jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint quality_rules_name_len check (char_length(rule_name) between 3 and 180),
  constraint quality_rules_metric_name_len check (char_length(metric_name) between 2 and 180),
  constraint quality_rules_threshold_range check (threshold >= 0 and threshold <= 100),
  constraint quality_rules_comparator_check check (comparator in ('gte', 'lte', 'eq')),
  constraint quality_rules_severity_check check (severity in ('info', 'warning', 'critical'))
);

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  subject_ref text not null,
  consent_type text not null,
  status text not null default 'granted',
  effective_at timestamptz not null default now(),
  expires_at timestamptz,
  evidence_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint consent_records_subject_ref_len check (char_length(subject_ref) between 3 and 160),
  constraint consent_records_type_check check (consent_type in ('research', 'trial_matching', 'genomics', 'data_sharing')),
  constraint consent_records_status_check check (status in ('granted', 'revoked', 'expired', 'pending'))
);

create table if not exists public.policy_configs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  policy_key text not null,
  policy_name text not null,
  policy_type text not null,
  status text not null default 'active',
  config_json jsonb not null default '{}'::jsonb,
  version_no int not null default 1,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (org_id, policy_key, version_no),
  constraint policy_configs_key_len check (char_length(policy_key) between 3 and 100),
  constraint policy_configs_name_len check (char_length(policy_name) between 3 and 180),
  constraint policy_configs_type_check check (policy_type in ('retention', 'access', 'deidentification', 'regional_restriction')),
  constraint policy_configs_status_check check (status in ('draft', 'active', 'archived'))
);

create table if not exists public.clinical_trials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid references public.studies(id) on delete set null,
  trial_code text not null,
  title text not null,
  phase text not null,
  status text not null default 'open',
  criteria_json jsonb not null default '{}'::jsonb,
  target_enrollment int,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (org_id, trial_code),
  constraint clinical_trials_code_len check (char_length(trial_code) between 3 and 60),
  constraint clinical_trials_title_len check (char_length(title) between 5 and 200),
  constraint clinical_trials_phase_check check (phase in ('I', 'II', 'III', 'IV', 'observational')),
  constraint clinical_trials_status_check check (status in ('open', 'review', 'paused', 'closed')),
  constraint clinical_trials_target_enrollment_nonneg check (target_enrollment is null or target_enrollment >= 0)
);

create table if not exists public.trial_matches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  trial_id uuid not null references public.clinical_trials(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete set null,
  eligibility_count int not null default 0,
  screened_count int not null default 0,
  precision_score numeric(5,2),
  status text not null default 'open',
  run_metadata jsonb not null default '{}'::jsonb,
  matched_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint trial_matches_counts_nonneg check (eligibility_count >= 0 and screened_count >= 0),
  constraint trial_matches_precision_range check (precision_score is null or (precision_score >= 0 and precision_score <= 100)),
  constraint trial_matches_status_check check (status in ('open', 'review', 'paused', 'closed'))
);

create table if not exists public.rwe_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid references public.studies(id) on delete set null,
  report_name text not null,
  report_type text not null,
  status text not null default 'draft',
  generated_at timestamptz,
  file_url text,
  summary_json jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint rwe_reports_name_len check (char_length(report_name) between 3 and 200),
  constraint rwe_reports_type_check check (report_type in ('safety', 'efficacy', 'outcomes', 'regulatory_package')),
  constraint rwe_reports_status_check check (status in ('draft', 'running', 'ready', 'failed', 'archived'))
);

create index if not exists idx_federated_operations_org_status_created
  on public.federated_operations(org_id, status, created_at desc)
  where deleted_at is null;

create index if not exists idx_connector_configs_org_status
  on public.connector_configs(org_id, status)
  where deleted_at is null;

create index if not exists idx_quality_rules_org_active
  on public.quality_rules(org_id, is_active)
  where deleted_at is null;

create index if not exists idx_consent_records_org_status
  on public.consent_records(org_id, status, effective_at desc)
  where deleted_at is null;

create index if not exists idx_policy_configs_org_type_status
  on public.policy_configs(org_id, policy_type, status)
  where deleted_at is null;

create index if not exists idx_clinical_trials_org_status
  on public.clinical_trials(org_id, status)
  where deleted_at is null;

create index if not exists idx_trial_matches_trial_matched
  on public.trial_matches(trial_id, matched_at desc)
  where deleted_at is null;

create index if not exists idx_rwe_reports_org_status
  on public.rwe_reports(org_id, status, created_at desc)
  where deleted_at is null;

drop trigger if exists set_federated_operations_updated_at on public.federated_operations;
create trigger set_federated_operations_updated_at
before update on public.federated_operations
for each row
execute function public.set_updated_at();

drop trigger if exists set_connector_configs_updated_at on public.connector_configs;
create trigger set_connector_configs_updated_at
before update on public.connector_configs
for each row
execute function public.set_updated_at();

drop trigger if exists set_quality_rules_updated_at on public.quality_rules;
create trigger set_quality_rules_updated_at
before update on public.quality_rules
for each row
execute function public.set_updated_at();

drop trigger if exists set_consent_records_updated_at on public.consent_records;
create trigger set_consent_records_updated_at
before update on public.consent_records
for each row
execute function public.set_updated_at();

drop trigger if exists set_policy_configs_updated_at on public.policy_configs;
create trigger set_policy_configs_updated_at
before update on public.policy_configs
for each row
execute function public.set_updated_at();

drop trigger if exists set_clinical_trials_updated_at on public.clinical_trials;
create trigger set_clinical_trials_updated_at
before update on public.clinical_trials
for each row
execute function public.set_updated_at();

drop trigger if exists set_trial_matches_updated_at on public.trial_matches;
create trigger set_trial_matches_updated_at
before update on public.trial_matches
for each row
execute function public.set_updated_at();

drop trigger if exists set_rwe_reports_updated_at on public.rwe_reports;
create trigger set_rwe_reports_updated_at
before update on public.rwe_reports
for each row
execute function public.set_updated_at();

alter table public.federated_operations enable row level security;
alter table public.connector_configs enable row level security;
alter table public.quality_rules enable row level security;
alter table public.consent_records enable row level security;
alter table public.policy_configs enable row level security;
alter table public.clinical_trials enable row level security;
alter table public.trial_matches enable row level security;
alter table public.rwe_reports enable row level security;

drop policy if exists "federated_operations_select_member" on public.federated_operations;
create policy "federated_operations_select_member"
  on public.federated_operations
  for select
  to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "federated_operations_insert_member" on public.federated_operations;
create policy "federated_operations_insert_member"
  on public.federated_operations
  for insert
  to authenticated
  with check (public.is_org_member(org_id) and created_by = auth.uid());

drop policy if exists "federated_operations_update_member" on public.federated_operations;
create policy "federated_operations_update_member"
  on public.federated_operations
  for update
  to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

drop policy if exists "connector_configs_select_member" on public.connector_configs;
create policy "connector_configs_select_member"
  on public.connector_configs
  for select
  to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "connector_configs_insert_member" on public.connector_configs;
create policy "connector_configs_insert_member"
  on public.connector_configs
  for insert
  to authenticated
  with check (public.is_org_member(org_id) and created_by = auth.uid());

drop policy if exists "connector_configs_update_member" on public.connector_configs;
create policy "connector_configs_update_member"
  on public.connector_configs
  for update
  to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

drop policy if exists "quality_rules_select_member" on public.quality_rules;
create policy "quality_rules_select_member"
  on public.quality_rules
  for select
  to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "quality_rules_insert_member" on public.quality_rules;
create policy "quality_rules_insert_member"
  on public.quality_rules
  for insert
  to authenticated
  with check (public.is_org_member(org_id) and created_by = auth.uid());

drop policy if exists "quality_rules_update_member" on public.quality_rules;
create policy "quality_rules_update_member"
  on public.quality_rules
  for update
  to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

drop policy if exists "consent_records_select_member" on public.consent_records;
create policy "consent_records_select_member"
  on public.consent_records
  for select
  to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "consent_records_insert_member" on public.consent_records;
create policy "consent_records_insert_member"
  on public.consent_records
  for insert
  to authenticated
  with check (public.is_org_member(org_id) and created_by = auth.uid());

drop policy if exists "consent_records_update_admin_owner" on public.consent_records;
create policy "consent_records_update_admin_owner"
  on public.consent_records
  for update
  to authenticated
  using (public.is_org_admin_or_owner(org_id))
  with check (public.is_org_admin_or_owner(org_id));

drop policy if exists "policy_configs_select_member" on public.policy_configs;
create policy "policy_configs_select_member"
  on public.policy_configs
  for select
  to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "policy_configs_insert_admin_owner" on public.policy_configs;
create policy "policy_configs_insert_admin_owner"
  on public.policy_configs
  for insert
  to authenticated
  with check (public.is_org_admin_or_owner(org_id) and created_by = auth.uid());

drop policy if exists "policy_configs_update_admin_owner" on public.policy_configs;
create policy "policy_configs_update_admin_owner"
  on public.policy_configs
  for update
  to authenticated
  using (public.is_org_admin_or_owner(org_id))
  with check (public.is_org_admin_or_owner(org_id));

drop policy if exists "clinical_trials_select_member" on public.clinical_trials;
create policy "clinical_trials_select_member"
  on public.clinical_trials
  for select
  to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "clinical_trials_insert_member" on public.clinical_trials;
create policy "clinical_trials_insert_member"
  on public.clinical_trials
  for insert
  to authenticated
  with check (public.is_org_member(org_id) and created_by = auth.uid());

drop policy if exists "clinical_trials_update_member" on public.clinical_trials;
create policy "clinical_trials_update_member"
  on public.clinical_trials
  for update
  to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

drop policy if exists "trial_matches_select_member" on public.trial_matches;
create policy "trial_matches_select_member"
  on public.trial_matches
  for select
  to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "trial_matches_insert_member" on public.trial_matches;
create policy "trial_matches_insert_member"
  on public.trial_matches
  for insert
  to authenticated
  with check (public.is_org_member(org_id) and created_by = auth.uid());

drop policy if exists "trial_matches_update_member" on public.trial_matches;
create policy "trial_matches_update_member"
  on public.trial_matches
  for update
  to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

drop policy if exists "rwe_reports_select_member" on public.rwe_reports;
create policy "rwe_reports_select_member"
  on public.rwe_reports
  for select
  to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "rwe_reports_insert_member" on public.rwe_reports;
create policy "rwe_reports_insert_member"
  on public.rwe_reports
  for insert
  to authenticated
  with check (public.is_org_member(org_id) and created_by = auth.uid());

drop policy if exists "rwe_reports_update_member" on public.rwe_reports;
create policy "rwe_reports_update_member"
  on public.rwe_reports
  for update
  to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
