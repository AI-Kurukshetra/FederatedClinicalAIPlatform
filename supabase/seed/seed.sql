-- Phase 2 demo seed
-- Inserts workspace-linked demo data for:
-- - federated_nodes
-- - ingestion_jobs
-- - data_quality_metrics
-- Seed is safe and idempotent when re-run.

do $$
declare
  v_user_id uuid;
  v_org_id uuid;
begin
  if to_regclass('public.federated_nodes') is null
    or to_regclass('public.ingestion_jobs') is null
    or to_regclass('public.data_quality_metrics') is null then
    raise notice 'Phase 2 tables not found. Run migrations first.';
    return;
  end if;

  select p.id
  into v_user_id
  from public.profiles p
  order by p.created_at asc
  limit 1;

  if v_user_id is null then
    raise notice 'No profiles found. Create/sign in a user first, then re-run seed.';
    return;
  end if;

  insert into public.organizations (name, slug, created_by)
  values ('Federated Oncology Demo', 'federated-oncology-demo', v_user_id)
  on conflict (slug) do update set updated_at = now()
  returning id into v_org_id;

  insert into public.organization_members (org_id, user_id, role, status)
  values (v_org_id, v_user_id, 'owner', 'active')
  on conflict (org_id, user_id) do update set
    role = excluded.role,
    status = excluded.status,
    updated_at = now();

  insert into public.federated_nodes (
    org_id, name, slug, region, endpoint_url, status, capabilities, last_heartbeat_at, created_by
  )
  values
    (
      v_org_id,
      'Mayo Partner Node',
      'mayo-partner-node',
      'us-east',
      'https://mayo-node.example.internal',
      'online',
      '{"modalities":["ehr","notes","lab"],"fhir_version":"R4"}'::jsonb,
      now() - interval '5 minutes',
      v_user_id
    ),
    (
      v_org_id,
      'West Coast Clinical Node',
      'west-coast-clinical-node',
      'us-west',
      'https://west-node.example.internal',
      'degraded',
      '{"modalities":["ehr","pacs"],"fhir_version":"R4"}'::jsonb,
      now() - interval '18 minutes',
      v_user_id
    ),
    (
      v_org_id,
      'Central Trial Node',
      'central-trial-node',
      'us-central',
      'https://central-node.example.internal',
      'online',
      '{"modalities":["ehr","notes","claims"],"fhir_version":"R4"}'::jsonb,
      now() - interval '2 minutes',
      v_user_id
    )
  on conflict (org_id, slug) do update set
    name = excluded.name,
    region = excluded.region,
    endpoint_url = excluded.endpoint_url,
    status = excluded.status,
    capabilities = excluded.capabilities,
    last_heartbeat_at = excluded.last_heartbeat_at,
    updated_at = now();

  if not exists (
    select 1 from public.ingestion_jobs
    where org_id = v_org_id and metadata ->> 'seed_key' = 'phase2_job_1' and deleted_at is null
  ) then
    insert into public.ingestion_jobs (
      org_id, node_id, source_name, source_type, status, records_processed, metadata,
      started_at, finished_at, triggered_by
    )
    values (
      v_org_id,
      (select id from public.federated_nodes where org_id = v_org_id and slug = 'mayo-partner-node'),
      'Epic EHR Feed',
      'ehr',
      'completed',
      128430,
      '{"seed_key":"phase2_job_1","pipeline":"nightly_ingestion"}'::jsonb,
      now() - interval '4 hours',
      now() - interval '3 hours 47 minutes',
      v_user_id
    );
  end if;

  if not exists (
    select 1 from public.ingestion_jobs
    where org_id = v_org_id and metadata ->> 'seed_key' = 'phase2_job_2' and deleted_at is null
  ) then
    insert into public.ingestion_jobs (
      org_id, node_id, source_name, source_type, status, records_processed, metadata,
      started_at, finished_at, triggered_by
    )
    values (
      v_org_id,
      (select id from public.federated_nodes where org_id = v_org_id and slug = 'west-coast-clinical-node'),
      'Radiology PACS Sync',
      'pacs',
      'running',
      24911,
      '{"seed_key":"phase2_job_2","pipeline":"imaging_sync"}'::jsonb,
      now() - interval '31 minutes',
      null,
      v_user_id
    );
  end if;

  if not exists (
    select 1 from public.ingestion_jobs
    where org_id = v_org_id and metadata ->> 'seed_key' = 'phase2_job_3' and deleted_at is null
  ) then
    insert into public.ingestion_jobs (
      org_id, node_id, source_name, source_type, status, error_message, metadata,
      started_at, finished_at, triggered_by
    )
    values (
      v_org_id,
      (select id from public.federated_nodes where org_id = v_org_id and slug = 'central-trial-node'),
      'Clinical Notes NLP Ingestion',
      'notes',
      'failed',
      'Tokenizer pipeline timeout on node worker-3',
      '{"seed_key":"phase2_job_3","pipeline":"notes_nlp_ingestion"}'::jsonb,
      now() - interval '1 hour 22 minutes',
      now() - interval '1 hour 11 minutes',
      v_user_id
    );
  end if;

  if not exists (
    select 1 from public.data_quality_metrics
    where org_id = v_org_id and details ->> 'seed_key' = 'phase2_quality_1' and deleted_at is null
  ) then
    insert into public.data_quality_metrics (
      org_id, source_name, metric_name, metric_value, status, details, measured_at, created_by
    )
    values
      (
        v_org_id,
        'Epic EHR Feed',
        'completeness_score',
        96.40,
        'good',
        '{"seed_key":"phase2_quality_1","dimension":"completeness"}'::jsonb,
        now() - interval '50 minutes',
        v_user_id
      ),
      (
        v_org_id,
        'Radiology PACS Sync',
        'schema_conformance',
        88.10,
        'warning',
        '{"seed_key":"phase2_quality_2","dimension":"conformance"}'::jsonb,
        now() - interval '42 minutes',
        v_user_id
      ),
      (
        v_org_id,
        'Clinical Notes NLP Ingestion',
        'terminology_coverage',
        91.30,
        'good',
        '{"seed_key":"phase2_quality_3","dimension":"semantic_coverage"}'::jsonb,
        now() - interval '37 minutes',
        v_user_id
      );
  end if;

  raise notice 'Phase 2 demo seed applied for org % and user %', v_org_id, v_user_id;
end $$;
