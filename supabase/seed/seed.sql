-- Full platform demo seed (Phase 1 + Phase 2 + Phase 3)
-- Safe seed: uses existing authenticated users from public.profiles.
-- This script does NOT insert into auth.users/auth.identities.

do $$
declare
  v_now timestamptz := now();
  u_owner uuid;
  u_admin uuid;
  u_researcher uuid;
  u_analyst uuid;
  u_member uuid;
  v_profile_count bigint;

  v_org_main uuid;
  v_org_partner uuid;
  v_existing_user uuid;

  v_cv_nsclc_v2 uuid;
  v_cv_t2d_v2 uuid;
  v_cv_hf_v1 uuid;

  v_node_mayo uuid;
  v_node_west uuid;
  v_node_eu uuid;

  v_trial_101 uuid;
  v_trial_102 uuid;
  v_trial_cardio uuid;
begin
  if to_regclass('public.profiles') is null
    or to_regclass('public.rwe_reports') is null then
    raise notice 'Required tables not found. Run migrations first.';
    return;
  end if;

  select count(*)
  into v_profile_count
  from public.profiles;

  if v_profile_count = 0 then
    raise notice 'No profiles found. Create at least one user account first, then rerun seed.';
    return;
  end if;

  with ranked as (
    select p.id, row_number() over (order by p.created_at asc, p.id asc) as rn
    from public.profiles p
  )
  select
    (select r.id from ranked r where r.rn = 1),
    (select r.id from ranked r where r.rn = 2),
    (select r.id from ranked r where r.rn = 3),
    (select r.id from ranked r where r.rn = 4),
    (select r.id from ranked r where r.rn = 5)
  into u_owner, u_admin, u_researcher, u_analyst, u_member;

  u_admin := coalesce(u_admin, u_owner);
  u_researcher := coalesce(u_researcher, u_owner);
  u_analyst := coalesce(u_analyst, u_owner);
  u_member := coalesce(u_member, u_owner);

  with pref_seed as (
    select *
    from (
      values
        (u_owner, 'system', 'en-US', 1),
        (u_admin, 'light', 'en-US', 2),
        (u_researcher, 'system', 'en-IN', 3),
        (u_analyst, 'dark', 'en-US', 4),
        (u_member, 'system', 'en-GB', 5)
    ) as p(user_id, theme, locale, priority)
  ),
  pref_dedup as (
    select distinct on (user_id) user_id, theme, locale
    from pref_seed
    where user_id is not null
    order by user_id, priority
  )
  insert into public.user_preferences (user_id, theme, locale, created_at, updated_at)
  select user_id, theme, locale, v_now, v_now
  from pref_dedup
  on conflict (user_id) do update
  set theme = excluded.theme, locale = excluded.locale, updated_at = now();

  insert into public.organizations (name, slug, created_by, created_at, updated_at)
  values ('Federated Oncology Demo', 'federated-oncology-demo', u_owner, v_now - interval '180 days', v_now)
  on conflict (slug) do update
  set name = excluded.name, created_by = excluded.created_by, updated_at = now(), deleted_at = null
  returning id into v_org_main;

  insert into public.organizations (name, slug, created_by, created_at, updated_at)
  values ('Cardio RWE Collaborative', 'cardio-rwe-collab', u_admin, v_now - interval '120 days', v_now)
  on conflict (slug) do update
  set name = excluded.name, created_by = excluded.created_by, updated_at = now(), deleted_at = null
  returning id into v_org_partner;

  insert into public.organizations (name, slug, created_by, created_at, updated_at)
  values ('Open Clinical Sandbox', 'open-clinical-sandbox', u_owner, v_now - interval '90 days', v_now)
  on conflict (slug) do update
  set name = excluded.name, created_by = excluded.created_by, updated_at = now(), deleted_at = null;

  with membership_seed as (
    select *
    from (
      values
        (v_org_main, u_owner, 'owner', 'active', v_now - interval '180 days', v_now - interval '180 days', v_now, 1),
        (v_org_main, u_admin, 'admin', 'active', v_now - interval '178 days', v_now - interval '178 days', v_now, 2),
        (v_org_main, u_researcher, 'researcher', 'active', v_now - interval '170 days', v_now - interval '170 days', v_now, 3),
        (v_org_main, u_analyst, 'analyst', 'active', v_now - interval '165 days', v_now - interval '165 days', v_now, 4),
        (v_org_main, u_member, 'member', 'active', v_now - interval '160 days', v_now - interval '160 days', v_now, 5),
        (v_org_partner, u_admin, 'owner', 'active', v_now - interval '120 days', v_now - interval '120 days', v_now, 1),
        (v_org_partner, u_researcher, 'analyst', 'active', v_now - interval '110 days', v_now - interval '110 days', v_now, 4),
        (v_org_partner, u_analyst, 'researcher', 'active', v_now - interval '108 days', v_now - interval '108 days', v_now, 3)
    ) as m(org_id, user_id, role, status, joined_at, created_at, updated_at, priority)
  ),
  membership_dedup as (
    select distinct on (org_id, user_id)
      org_id, user_id, role, status, joined_at, created_at, updated_at
    from membership_seed
    where user_id is not null
    order by org_id, user_id, priority
  )
  insert into public.organization_members (org_id, user_id, role, status, joined_at, created_at, updated_at)
  select org_id, user_id, role, status, joined_at, created_at, updated_at
  from membership_dedup
  on conflict (org_id, user_id) do update
  set role = excluded.role, status = excluded.status, updated_at = now(), deleted_at = null;

  select p.id into v_existing_user
  from public.profiles p
  where p.id not in (u_owner, u_admin, u_researcher, u_analyst, u_member)
  order by p.created_at asc
  limit 1;

  if v_existing_user is not null then
    insert into public.organization_members (org_id, user_id, role, status, joined_at, created_at, updated_at)
    values (v_org_main, v_existing_user, 'admin', 'active', v_now - interval '1 day', v_now - interval '1 day', v_now)
    on conflict (org_id, user_id) do update
    set role = excluded.role, status = excluded.status, updated_at = now(), deleted_at = null;
  end if;

  insert into public.invites (id, org_id, email, role, token, expires_at, invited_by, created_at, updated_at)
  values
    ('98000000-0000-4000-8000-000000000001', v_org_main, 'external.monitor@seed.nference.local', 'analyst', 'seed-invite-main-analyst', v_now + interval '14 days', u_admin, v_now - interval '2 days', v_now),
    ('98000000-0000-4000-8000-000000000002', v_org_partner, 'cardio.viewer@seed.nference.local', 'member', 'seed-invite-cardio-member', v_now + interval '7 days', u_admin, v_now - interval '1 day', v_now)
  on conflict (id) do update
  set org_id = excluded.org_id, email = excluded.email, role = excluded.role, token = excluded.token, expires_at = excluded.expires_at, invited_by = excluded.invited_by, updated_at = now(), deleted_at = null;

  insert into public.studies (id, org_id, name, description, status, owner_id, created_at, updated_at)
  values
    ('70000000-0000-4000-8000-000000000001', v_org_main, 'NSCLC Real-World Response', 'Observational oncology outcomes study for NSCLC response patterns.', 'active', u_owner, v_now - interval '160 days', v_now - interval '1 day'),
    ('70000000-0000-4000-8000-000000000002', v_org_main, 'Type 2 Diabetes Adherence Program', 'Medication adherence and glycemic control longitudinal analysis.', 'active', u_researcher, v_now - interval '140 days', v_now - interval '2 days'),
    ('70000000-0000-4000-8000-000000000003', v_org_main, 'Heart Failure Readmission Surveillance', '30/90 day readmission prediction and intervention assessment.', 'paused', u_owner, v_now - interval '120 days', v_now - interval '5 days'),
    ('70000000-0000-4000-8000-000000000004', v_org_partner, 'Cardio-RWE Multi-Site Study', 'Cardiometabolic outcome benchmarking across partner institutions.', 'active', u_admin, v_now - interval '100 days', v_now - interval '1 day')
  on conflict (id) do update
  set org_id = excluded.org_id, name = excluded.name, description = excluded.description, status = excluded.status, owner_id = excluded.owner_id, updated_at = excluded.updated_at, deleted_at = null;

  with study_member_seed as (
    select *
    from (
      values
        ('70000000-0000-4000-8000-000000000001'::uuid, u_owner, 'owner', v_now - interval '160 days', v_now - interval '160 days', v_now, 1),
        ('70000000-0000-4000-8000-000000000001'::uuid, u_admin, 'editor', v_now - interval '159 days', v_now - interval '159 days', v_now, 2),
        ('70000000-0000-4000-8000-000000000002'::uuid, u_researcher, 'owner', v_now - interval '140 days', v_now - interval '140 days', v_now, 1),
        ('70000000-0000-4000-8000-000000000002'::uuid, u_analyst, 'editor', v_now - interval '137 days', v_now - interval '137 days', v_now, 2),
        ('70000000-0000-4000-8000-000000000004'::uuid, u_admin, 'owner', v_now - interval '100 days', v_now - interval '100 days', v_now, 1),
        ('70000000-0000-4000-8000-000000000004'::uuid, u_analyst, 'editor', v_now - interval '98 days', v_now - interval '98 days', v_now, 2)
    ) as s(study_id, user_id, role, added_at, created_at, updated_at, priority)
  ),
  study_member_dedup as (
    select distinct on (study_id, user_id)
      study_id, user_id, role, added_at, created_at, updated_at
    from study_member_seed
    where user_id is not null
    order by study_id, user_id, priority
  )
  insert into public.study_members (study_id, user_id, role, added_at, created_at, updated_at)
  select study_id, user_id, role, added_at, created_at, updated_at
  from study_member_dedup
  on conflict (study_id, user_id) do update
  set role = excluded.role, added_at = excluded.added_at, updated_at = now(), deleted_at = null;

  if not exists (select 1 from public.study_activity where metadata ->> 'seed_key' = 'seed_study_activity_001') then
    insert into public.study_activity (study_id, actor_id, action, metadata, created_at)
    values ('70000000-0000-4000-8000-000000000001', u_owner, 'created_study', '{"seed_key":"seed_study_activity_001"}'::jsonb, v_now - interval '160 days');
  end if;

  insert into public.cohorts (id, org_id, study_id, name, description, created_by, created_at, updated_at)
  values
    ('80000000-0000-4000-8000-000000000001', v_org_main, '70000000-0000-4000-8000-000000000001', 'NSCLC PD-L1 High Responders', 'Stage IV NSCLC with PD-L1 >= 50 and first-line IO.', u_owner, v_now - interval '150 days', v_now - interval '2 days'),
    ('80000000-0000-4000-8000-000000000002', v_org_main, '70000000-0000-4000-8000-000000000002', 'T2D Metformin Adherent', 'Type 2 diabetes with adherence >= 80 percent.', u_researcher, v_now - interval '134 days', v_now - interval '1 day'),
    ('80000000-0000-4000-8000-000000000003', v_org_main, '70000000-0000-4000-8000-000000000003', 'HF Reduced EF 65+', 'Heart failure reduced EF with age >= 65 subgroup.', u_owner, v_now - interval '118 days', v_now - interval '3 days'),
    ('80000000-0000-4000-8000-000000000004', v_org_partner, '70000000-0000-4000-8000-000000000004', 'Cardio High Risk LDL', 'Cardiometabolic risk with LDL >= 160 and hypertension.', u_analyst, v_now - interval '88 days', v_now - interval '2 days')
  on conflict (id) do update
  set org_id = excluded.org_id, study_id = excluded.study_id, name = excluded.name, description = excluded.description, created_by = excluded.created_by, updated_at = excluded.updated_at, deleted_at = null;

  insert into public.cohort_versions (cohort_id, version_no, definition_json, created_by, created_at)
  values
    ('80000000-0000-4000-8000-000000000001', 1, '{"inclusion":["diagnosis=NSCLC","pd_l1>=50"],"exclusion":[]}'::jsonb, u_owner, v_now - interval '149 days'),
    ('80000000-0000-4000-8000-000000000001', 2, '{"inclusion":["diagnosis=NSCLC","pd_l1>=50","stage=IV"],"exclusion":["egfr_mutation=true"]}'::jsonb, u_owner, v_now - interval '120 days'),
    ('80000000-0000-4000-8000-000000000002', 1, '{"inclusion":["diagnosis=t2d","metformin=true","adherence>=70"],"exclusion":[]}'::jsonb, u_researcher, v_now - interval '133 days'),
    ('80000000-0000-4000-8000-000000000002', 2, '{"inclusion":["diagnosis=t2d","metformin=true","adherence>=80"],"exclusion":["egfr<30"]}'::jsonb, u_researcher, v_now - interval '102 days'),
    ('80000000-0000-4000-8000-000000000003', 1, '{"inclusion":["diagnosis=heart_failure","ef<40","age>=65"],"exclusion":[]}'::jsonb, u_owner, v_now - interval '116 days'),
    ('80000000-0000-4000-8000-000000000004', 1, '{"inclusion":["ldl>=160","hypertension=true"],"exclusion":[]}'::jsonb, u_analyst, v_now - interval '87 days')
  on conflict (cohort_id, version_no) do update
  set definition_json = excluded.definition_json, created_by = excluded.created_by, created_at = excluded.created_at;

  select id into v_cv_nsclc_v2 from public.cohort_versions where cohort_id = '80000000-0000-4000-8000-000000000001' and version_no = 2;
  select id into v_cv_t2d_v2 from public.cohort_versions where cohort_id = '80000000-0000-4000-8000-000000000002' and version_no = 2;
  select id into v_cv_hf_v1 from public.cohort_versions where cohort_id = '80000000-0000-4000-8000-000000000003' and version_no = 1;

  insert into public.cohort_runs (id, cohort_version_id, status, result_count, executed_at, started_at, finished_at, created_by, created_at, updated_at)
  values
    ('82000000-0000-4000-8000-000000000001', v_cv_nsclc_v2, 'completed', 324, v_now - interval '10 days', v_now - interval '10 days 45 minutes', v_now - interval '10 days 35 minutes', u_analyst, v_now - interval '10 days 50 minutes', v_now - interval '10 days 34 minutes'),
    ('82000000-0000-4000-8000-000000000002', v_cv_nsclc_v2, 'completed', 338, v_now - interval '6 days', v_now - interval '6 days 42 minutes', v_now - interval '6 days 30 minutes', u_analyst, v_now - interval '6 days 45 minutes', v_now - interval '6 days 30 minutes'),
    ('82000000-0000-4000-8000-000000000003', v_cv_t2d_v2, 'completed', 412, v_now - interval '4 days', v_now - interval '4 days 40 minutes', v_now - interval '4 days 29 minutes', u_researcher, v_now - interval '4 days 42 minutes', v_now - interval '4 days 28 minutes'),
    ('82000000-0000-4000-8000-000000000004', v_cv_hf_v1, 'running', null, null, v_now - interval '2 hours', null, u_owner, v_now - interval '2 hours 5 minutes', v_now - interval '2 hours')
  on conflict (id) do update
  set cohort_version_id = excluded.cohort_version_id, status = excluded.status, result_count = excluded.result_count, executed_at = excluded.executed_at, started_at = excluded.started_at, finished_at = excluded.finished_at, created_by = excluded.created_by, updated_at = excluded.updated_at;

  insert into public.federated_nodes (
    org_id, name, slug, region, endpoint_url, status, capabilities, last_heartbeat_at, created_by, created_at, updated_at
  )
  values
    (v_org_main, 'Mayo Partner Node', 'mayo-partner-node', 'us-east', 'https://mayo-node.example.internal', 'online', '{"modalities":["ehr","notes","lab"],"fhir_version":"R4"}'::jsonb, v_now - interval '3 minutes', u_owner, v_now - interval '120 days', v_now),
    (v_org_main, 'West Coast Clinical Node', 'west-coast-clinical-node', 'us-west', 'https://west-node.example.internal', 'degraded', '{"modalities":["ehr","pacs"],"fhir_version":"R4"}'::jsonb, v_now - interval '14 minutes', u_owner, v_now - interval '119 days', v_now),
    (v_org_partner, 'EU Cardio Node', 'eu-cardio-node', 'eu-west', 'https://eu-cardio-node.example.internal', 'online', '{"modalities":["ehr","claims","fhir"],"fhir_version":"R4"}'::jsonb, v_now - interval '4 minutes', u_admin, v_now - interval '80 days', v_now)
  on conflict (org_id, slug) do update
  set
    name = excluded.name,
    region = excluded.region,
    endpoint_url = excluded.endpoint_url,
    status = excluded.status,
    capabilities = excluded.capabilities,
    last_heartbeat_at = excluded.last_heartbeat_at,
    created_by = excluded.created_by,
    updated_at = excluded.updated_at,
    deleted_at = null;

  select id into v_node_mayo from public.federated_nodes where org_id = v_org_main and slug = 'mayo-partner-node';
  select id into v_node_west from public.federated_nodes where org_id = v_org_main and slug = 'west-coast-clinical-node';
  select id into v_node_eu from public.federated_nodes where org_id = v_org_partner and slug = 'eu-cardio-node';

  insert into public.connector_configs (
    id, org_id, node_id, name, source_type, status, schedule_cron, config_json, last_sync_at, created_by, created_at, updated_at
  )
  values
    ('93000000-0000-4000-8000-000000000001', v_org_main, v_node_mayo, 'Epic EHR Connector', 'ehr', 'active', '0 */6 * * *', '{"format":"hl7v2","batch_size":1000}'::jsonb, v_now - interval '40 minutes', u_admin, v_now - interval '115 days', v_now),
    ('93000000-0000-4000-8000-000000000002', v_org_main, v_node_west, 'PACS Imaging Connector', 'pacs', 'active', '0 */12 * * *', '{"dicom_qr":true,"compression":"lossless"}'::jsonb, v_now - interval '1 hour 10 minutes', u_admin, v_now - interval '112 days', v_now),
    ('93000000-0000-4000-8000-000000000003', v_org_partner, v_node_eu, 'Partner FHIR Sync', 'fhir', 'active', '0 */3 * * *', '{"fhir_version":"R4","resource_types":["Patient","Observation","Condition"]}'::jsonb, v_now - interval '35 minutes', u_admin, v_now - interval '78 days', v_now)
  on conflict (id) do update
  set
    org_id = excluded.org_id,
    node_id = excluded.node_id,
    name = excluded.name,
    source_type = excluded.source_type,
    status = excluded.status,
    schedule_cron = excluded.schedule_cron,
    config_json = excluded.config_json,
    last_sync_at = excluded.last_sync_at,
    created_by = excluded.created_by,
    updated_at = excluded.updated_at,
    deleted_at = null;

  insert into public.quality_rules (
    id, org_id, connector_id, rule_name, metric_name, threshold, comparator, severity, is_active, rule_json, created_by, created_at, updated_at
  )
  values
    ('94000000-0000-4000-8000-000000000001', v_org_main, '93000000-0000-4000-8000-000000000001', 'EHR Completeness Floor', 'completeness_score', 92.00, 'gte', 'warning', true, '{"window":"24h"}'::jsonb, u_admin, v_now - interval '110 days', v_now),
    ('94000000-0000-4000-8000-000000000002', v_org_main, '93000000-0000-4000-8000-000000000002', 'PACS Conformance Floor', 'schema_conformance', 88.00, 'gte', 'critical', true, '{"window":"24h"}'::jsonb, u_analyst, v_now - interval '108 days', v_now),
    ('94000000-0000-4000-8000-000000000003', v_org_partner, '93000000-0000-4000-8000-000000000003', 'FHIR Timeliness Guard', 'timeliness_score', 90.00, 'gte', 'warning', true, '{"window":"24h"}'::jsonb, u_admin, v_now - interval '75 days', v_now)
  on conflict (id) do update
  set
    org_id = excluded.org_id,
    connector_id = excluded.connector_id,
    rule_name = excluded.rule_name,
    metric_name = excluded.metric_name,
    threshold = excluded.threshold,
    comparator = excluded.comparator,
    severity = excluded.severity,
    is_active = excluded.is_active,
    rule_json = excluded.rule_json,
    created_by = excluded.created_by,
    updated_at = excluded.updated_at,
    deleted_at = null;

  insert into public.ingestion_jobs (
    id, org_id, node_id, source_name, source_type, status, records_processed, error_message, metadata,
    started_at, finished_at, triggered_by, created_at, updated_at
  )
  values
    ('96000000-0000-4000-8000-000000000001', v_org_main, v_node_mayo, 'Epic EHR Feed', 'ehr', 'completed', 128430, null, '{"seed_key":"seed_ingestion_001"}'::jsonb, v_now - interval '4 hours', v_now - interval '3 hours 47 minutes', u_admin, v_now - interval '4 hours', v_now - interval '3 hours 47 minutes'),
    ('96000000-0000-4000-8000-000000000002', v_org_main, v_node_west, 'Radiology PACS Sync', 'pacs', 'running', 24911, null, '{"seed_key":"seed_ingestion_002"}'::jsonb, v_now - interval '31 minutes', null, u_admin, v_now - interval '31 minutes', v_now - interval '2 minutes'),
    ('96000000-0000-4000-8000-000000000003', v_org_partner, v_node_eu, 'EU FHIR Observations', 'fhir', 'completed', 78120, null, '{"seed_key":"seed_ingestion_003"}'::jsonb, v_now - interval '5 hours', v_now - interval '4 hours 40 minutes', u_admin, v_now - interval '5 hours', v_now - interval '4 hours 40 minutes')
  on conflict (id) do update
  set
    org_id = excluded.org_id,
    node_id = excluded.node_id,
    source_name = excluded.source_name,
    source_type = excluded.source_type,
    status = excluded.status,
    records_processed = excluded.records_processed,
    error_message = excluded.error_message,
    metadata = excluded.metadata,
    started_at = excluded.started_at,
    finished_at = excluded.finished_at,
    triggered_by = excluded.triggered_by,
    updated_at = excluded.updated_at,
    deleted_at = null;

  insert into public.data_quality_metrics (
    org_id, source_name, metric_name, metric_value, status, details, measured_at, created_by, created_at, updated_at
  )
  select
    src.org_id,
    src.source_name,
    src.metric_name,
    greatest(55::numeric, least(99::numeric, src.base + ((gs.day_offset % 5) - 2) * src.volatility))::numeric(7,2),
    case
      when src.base + ((gs.day_offset % 5) - 2) * src.volatility >= 92 then 'good'
      when src.base + ((gs.day_offset % 5) - 2) * src.volatility >= 80 then 'warning'
      else 'critical'
    end,
    jsonb_build_object('seed_key', format('seed_quality_%s_%s', src.seed_code, gs.day_offset), 'dimension', src.metric_name),
    v_now - make_interval(days => gs.day_offset),
    src.created_by,
    v_now - make_interval(days => gs.day_offset),
    v_now - make_interval(days => gs.day_offset)
  from generate_series(0, 13) as gs(day_offset)
  join (
    values
      (v_org_main, 'Epic EHR Feed', 'completeness_score', 95.0::numeric, 1.5::numeric, 'ehr_main', u_analyst),
      (v_org_main, 'Radiology PACS Sync', 'schema_conformance', 87.0::numeric, 2.2::numeric, 'pacs_main', u_analyst),
      (v_org_partner, 'EU FHIR Observations', 'timeliness_score', 93.0::numeric, 1.2::numeric, 'fhir_partner', u_admin)
  ) as src(org_id, source_name, metric_name, base, volatility, seed_code, created_by)
    on true
  where not exists (
    select 1
    from public.data_quality_metrics d
    where d.org_id = src.org_id
      and d.details ->> 'seed_key' = format('seed_quality_%s_%s', src.seed_code, gs.day_offset)
      and d.deleted_at is null
  );

  insert into public.federated_operations (
    id, org_id, node_id, operation_type, status, priority, payload, result, error_message,
    queued_at, started_at, finished_at, created_by, created_at, updated_at
  )
  values
    ('97000000-0000-4000-8000-000000000001', v_org_main, v_node_mayo, 'connectivity_check', 'completed', 40, '{"seed_key":"seed_op_001"}'::jsonb, '{"latency_ms":110,"status":"ok"}'::jsonb, null, v_now - interval '8 hours', v_now - interval '8 hours', v_now - interval '7 hours 58 minutes', u_admin, v_now - interval '8 hours', v_now - interval '7 hours 58 minutes'),
    ('97000000-0000-4000-8000-000000000002', v_org_main, v_node_west, 'quality_scan', 'completed', 55, '{"seed_key":"seed_op_002"}'::jsonb, '{"warnings":2,"critical":0}'::jsonb, null, v_now - interval '6 hours', v_now - interval '6 hours', v_now - interval '5 hours 48 minutes', u_analyst, v_now - interval '6 hours', v_now - interval '5 hours 48 minutes'),
    ('97000000-0000-4000-8000-000000000003', v_org_partner, v_node_eu, 'analysis_run', 'running', 60, '{"seed_key":"seed_op_003"}'::jsonb, '{}'::jsonb, null, v_now - interval '25 minutes', v_now - interval '25 minutes', null, u_admin, v_now - interval '25 minutes', v_now - interval '2 minutes')
  on conflict (id) do update
  set
    org_id = excluded.org_id,
    node_id = excluded.node_id,
    operation_type = excluded.operation_type,
    status = excluded.status,
    priority = excluded.priority,
    payload = excluded.payload,
    result = excluded.result,
    error_message = excluded.error_message,
    queued_at = excluded.queued_at,
    started_at = excluded.started_at,
    finished_at = excluded.finished_at,
    created_by = excluded.created_by,
    updated_at = excluded.updated_at,
    deleted_at = null;

  insert into public.consent_records (
    id, org_id, subject_ref, consent_type, status, effective_at, expires_at, evidence_ref, metadata,
    created_by, created_at, updated_at
  )
  values
    ('95000000-0000-4000-8000-000000000001', v_org_main, 'subject-NSCLC-0001', 'research', 'granted', v_now - interval '220 days', v_now + interval '500 days', 'consent-doc://2026/03/01/subject-NSCLC-0001', '{"seed_key":"seed_consent_001"}'::jsonb, u_owner, v_now - interval '220 days', v_now),
    ('95000000-0000-4000-8000-000000000002', v_org_main, 'subject-T2D-0104', 'trial_matching', 'granted', v_now - interval '180 days', v_now + interval '400 days', 'consent-doc://2026/03/02/subject-T2D-0104', '{"seed_key":"seed_consent_002"}'::jsonb, u_researcher, v_now - interval '180 days', v_now),
    ('95000000-0000-4000-8000-000000000003', v_org_partner, 'subject-CARDIO-0901', 'research', 'granted', v_now - interval '90 days', v_now + interval '365 days', 'consent-doc://2026/03/03/subject-CARDIO-0901', '{"seed_key":"seed_consent_003"}'::jsonb, u_admin, v_now - interval '90 days', v_now)
  on conflict (id) do update
  set
    org_id = excluded.org_id,
    subject_ref = excluded.subject_ref,
    consent_type = excluded.consent_type,
    status = excluded.status,
    effective_at = excluded.effective_at,
    expires_at = excluded.expires_at,
    evidence_ref = excluded.evidence_ref,
    metadata = excluded.metadata,
    created_by = excluded.created_by,
    updated_at = excluded.updated_at,
    deleted_at = null;

  insert into public.policy_configs (
    org_id, policy_key, policy_name, policy_type, status, config_json, version_no, created_by, created_at, updated_at
  )
  values
    (v_org_main, 'retention_policy', 'Research Retention Policy', 'retention', 'draft', '{"years":5,"scope":["notes","ehr"]}'::jsonb, 1, u_admin, v_now - interval '90 days', v_now),
    (v_org_main, 'retention_policy', 'Research Retention Policy', 'retention', 'active', '{"years":7,"scope":["notes","ehr","claims"]}'::jsonb, 2, u_admin, v_now - interval '20 days', v_now),
    (v_org_partner, 'regional_access_policy', 'EU Regional Restriction', 'regional_restriction', 'active', '{"allowed_regions":["eu-west"],"blocked_regions":["us-east","us-west"]}'::jsonb, 1, u_admin, v_now - interval '60 days', v_now)
  on conflict (org_id, policy_key, version_no) do update
  set
    policy_name = excluded.policy_name,
    policy_type = excluded.policy_type,
    status = excluded.status,
    config_json = excluded.config_json,
    created_by = excluded.created_by,
    updated_at = excluded.updated_at,
    deleted_at = null;

  insert into public.clinical_trials (
    org_id, study_id, trial_code, title, phase, status, criteria_json, target_enrollment, created_by, created_at, updated_at
  )
  values
    (v_org_main, '70000000-0000-4000-8000-000000000001', 'NCT-2026-101', 'Phase III NSCLC Immunotherapy Escalation', 'III', 'open', '{"inclusion":["NSCLC","PD-L1>=50"],"exclusion":["EGFR mutation"]}'::jsonb, 350, u_owner, v_now - interval '100 days', v_now),
    (v_org_main, '70000000-0000-4000-8000-000000000002', 'NCT-2026-102', 'T2D Adherence Digital Intervention', 'II', 'open', '{"inclusion":["T2D","A1c>=8"],"exclusion":["pregnancy"]}'::jsonb, 500, u_researcher, v_now - interval '88 days', v_now),
    (v_org_partner, '70000000-0000-4000-8000-000000000004', 'CARDIO-2026-001', 'Cardio Outcomes Pragmatic Trial', 'IV', 'open', '{"inclusion":["LDL>=160"],"exclusion":["advanced_ckd"]}'::jsonb, 420, u_admin, v_now - interval '68 days', v_now)
  on conflict (org_id, trial_code) do update
  set
    study_id = excluded.study_id,
    title = excluded.title,
    phase = excluded.phase,
    status = excluded.status,
    criteria_json = excluded.criteria_json,
    target_enrollment = excluded.target_enrollment,
    created_by = excluded.created_by,
    updated_at = excluded.updated_at,
    deleted_at = null;

  select id into v_trial_101 from public.clinical_trials where org_id = v_org_main and trial_code = 'NCT-2026-101';
  select id into v_trial_102 from public.clinical_trials where org_id = v_org_main and trial_code = 'NCT-2026-102';
  select id into v_trial_cardio from public.clinical_trials where org_id = v_org_partner and trial_code = 'CARDIO-2026-001';

  insert into public.trial_matches (
    id, org_id, trial_id, cohort_id, eligibility_count, screened_count, precision_score, status,
    run_metadata, matched_at, created_by, created_at, updated_at
  )
  values
    ('91000000-0000-4000-8000-000000000001', v_org_main, v_trial_101, '80000000-0000-4000-8000-000000000001', 253, 324, 78.09, 'open', '{"seed_key":"seed_match_001","window":"12m"}'::jsonb, v_now - interval '7 days', u_analyst, v_now - interval '7 days', v_now),
    ('91000000-0000-4000-8000-000000000002', v_org_main, v_trial_102, '80000000-0000-4000-8000-000000000002', 312, 412, 75.73, 'open', '{"seed_key":"seed_match_002","window":"12m"}'::jsonb, v_now - interval '3 days', u_researcher, v_now - interval '3 days', v_now),
    ('91000000-0000-4000-8000-000000000003', v_org_partner, v_trial_cardio, '80000000-0000-4000-8000-000000000004', 201, 267, 75.28, 'open', '{"seed_key":"seed_match_003","window":"12m"}'::jsonb, v_now - interval '4 days', u_analyst, v_now - interval '4 days', v_now)
  on conflict (id) do update
  set
    org_id = excluded.org_id,
    trial_id = excluded.trial_id,
    cohort_id = excluded.cohort_id,
    eligibility_count = excluded.eligibility_count,
    screened_count = excluded.screened_count,
    precision_score = excluded.precision_score,
    status = excluded.status,
    run_metadata = excluded.run_metadata,
    matched_at = excluded.matched_at,
    created_by = excluded.created_by,
    updated_at = excluded.updated_at,
    deleted_at = null;

  insert into public.rwe_reports (
    id, org_id, study_id, report_name, report_type, status, generated_at, file_url, summary_json, created_by, created_at, updated_at
  )
  values
    ('92000000-0000-4000-8000-000000000001', v_org_main, '70000000-0000-4000-8000-000000000001', 'NSCLC Efficacy Interim - Q1', 'efficacy', 'ready', v_now - interval '8 days', 'https://reports.example.internal/nsclc-q1.pdf', '{"sample_size":324,"or":1.28,"confidence":"95%"}'::jsonb, u_owner, v_now - interval '8 days', v_now),
    ('92000000-0000-4000-8000-000000000002', v_org_main, '70000000-0000-4000-8000-000000000002', 'T2D Outcomes Pack - Feb', 'outcomes', 'ready', v_now - interval '12 days', 'https://reports.example.internal/t2d-feb.pdf', '{"hba1c_reduction":1.3,"adherence_gain":12.2}'::jsonb, u_researcher, v_now - interval '12 days', v_now),
    ('92000000-0000-4000-8000-000000000003', v_org_partner, '70000000-0000-4000-8000-000000000004', 'Cardio Regulatory Draft', 'regulatory_package', 'draft', null, null, '{"sections_complete":6,"sections_total":14}'::jsonb, u_admin, v_now - interval '3 days', v_now)
  on conflict (id) do update
  set
    org_id = excluded.org_id,
    study_id = excluded.study_id,
    report_name = excluded.report_name,
    report_type = excluded.report_type,
    status = excluded.status,
    generated_at = excluded.generated_at,
    file_url = excluded.file_url,
    summary_json = excluded.summary_json,
    created_by = excluded.created_by,
    updated_at = excluded.updated_at,
    deleted_at = null;

  if not exists (select 1 from public.audit_logs where metadata ->> 'seed_key' = 'seed_audit_001') then
    insert into public.audit_logs (actor_id, action, entity, entity_id, metadata, created_at)
    values (u_owner, 'study.created', 'studies', '70000000-0000-4000-8000-000000000001', '{"seed_key":"seed_audit_001"}'::jsonb, v_now - interval '160 days');
  end if;

  if not exists (select 1 from public.audit_logs where metadata ->> 'seed_key' = 'seed_audit_002') then
    insert into public.audit_logs (actor_id, action, entity, entity_id, metadata, created_at)
    values (u_admin, 'policy.activated', 'policy_configs', 'retention_policy:v2', '{"seed_key":"seed_audit_002"}'::jsonb, v_now - interval '20 days');
  end if;

  if not exists (select 1 from public.audit_logs where metadata ->> 'seed_key' = 'seed_audit_003') then
    insert into public.audit_logs (actor_id, action, entity, entity_id, metadata, created_at)
    values (u_analyst, 'trial.match_run', 'trial_matches', '91000000-0000-4000-8000-000000000002', '{"seed_key":"seed_audit_003"}'::jsonb, v_now - interval '3 days');
  end if;

  raise notice 'Full demo seed applied. Main org: %, Partner org: %', v_org_main, v_org_partner;
end $$;
