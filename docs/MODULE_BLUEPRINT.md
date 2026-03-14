# Database-Backed Module Blueprint

This maps the product into implementable modules with DB, API, and UI scope.

## 1) Auth and Access Control
Tables:
- `organizations` (id, name, slug, created_at)
- `organization_members` (org_id, user_id, role, status, joined_at)
- `invites` (org_id, email, role, token, expires_at, accepted_at)
- `profiles` (already exists)

APIs:
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `POST /api/orgs/:orgId/invites`
- `POST /api/invites/accept`

UI Screens:
- `/login`
- `/signup`
- `/onboarding/create-org`
- `/settings/members`

## 2) Workspace and Study Management
Tables:
- `studies` (id, org_id, name, description, status, owner_id, created_at)
- `study_members` (study_id, user_id, role, added_at)
- `study_activity` (id, study_id, actor_id, action, metadata, created_at)

APIs:
- `GET /api/studies`
- `POST /api/studies`
- `GET /api/studies/:id`
- `PATCH /api/studies/:id`
- `POST /api/studies/:id/members`

UI Screens:
- `/dashboard`
- `/studies`
- `/studies/[id]`
- `/studies/[id]/settings`

## 3) Cohort Builder
Tables:
- `cohorts` (id, org_id, study_id, name, description, created_by, created_at)
- `cohort_versions` (id, cohort_id, version_no, definition_json, created_by, created_at)
- `cohort_runs` (id, cohort_version_id, status, result_count, executed_at)

APIs:
- `GET /api/cohorts`
- `POST /api/cohorts`
- `GET /api/cohorts/:id`
- `POST /api/cohorts/:id/versions`
- `POST /api/cohorts/:id/run`

UI Screens:
- `/cohorts`
- `/cohorts/new`
- `/cohorts/[id]`
- `/cohorts/[id]/builder`

## 4) Clinical Data Catalog
Tables:
- `data_sources` (id, org_id, name, type, status, last_sync_at)
- `clinical_entities` (id, source_id, entity_name, standard_code_system)
- `clinical_fields` (id, entity_id, field_name, data_type, nullable, description)
- `data_quality_metrics` (id, source_id, metric_name, metric_value, measured_at)

APIs:
- `GET /api/catalog/sources`
- `GET /api/catalog/entities`
- `GET /api/catalog/entities/:id/fields`
- `GET /api/catalog/quality`

UI Screens:
- `/catalog`
- `/catalog/sources`
- `/catalog/entities/[id]`
- `/quality`

## 5) NLP Note Search
Tables:
- `clinical_notes` (id, org_id, patient_id, note_type, note_text, note_date)
- `note_concepts` (id, note_id, concept_code, concept_label, confidence)
- `nlp_jobs` (id, source_id, status, started_at, completed_at)

APIs:
- `POST /api/nlp/index`
- `GET /api/nlp/jobs/:id`
- `POST /api/search/notes`

UI Screens:
- `/notes/search`
- `/notes/results`
- `/notes/jobs`

## 6) Patient Timeline (De-Identified)
Tables:
- `patients` (id, org_id, external_hash_id, birth_year, sex, created_at)
- `encounters` (id, patient_id, encounter_type, encounter_date, facility)
- `conditions` (id, patient_id, code, label, onset_date)
- `medications` (id, patient_id, code, label, start_date, end_date)
- `lab_results` (id, patient_id, loinc_code, test_name, value, unit, observed_at)

APIs:
- `GET /api/patients/:id/timeline`
- `GET /api/patients/:id/summary`

UI Screens:
- `/patients/[id]`
- `/patients/[id]/timeline`

## 7) Analytics and RWE
Tables:
- `analysis_queries` (id, org_id, study_id, name, query_json, created_by, created_at)
- `analysis_runs` (id, query_id, status, result_json, started_at, finished_at)
- `analysis_exports` (id, run_id, format, file_url, created_at)

APIs:
- `POST /api/analytics/run`
- `GET /api/analytics/runs/:id`
- `POST /api/analytics/runs/:id/export`

UI Screens:
- `/analytics`
- `/analytics/runs/[id]`
- `/analytics/reports`

## 8) Trial Feasibility
Tables:
- `trials` (id, org_id, protocol_no, title, phase, status)
- `trial_criteria` (id, trial_id, type, rule_json)
- `trial_feasibility_runs` (id, trial_id, status, eligible_count, breakdown_json, created_at)

APIs:
- `POST /api/trials`
- `POST /api/trials/:id/criteria`
- `POST /api/trials/:id/feasibility/run`
- `GET /api/trials/:id/feasibility/:runId`

UI Screens:
- `/trials`
- `/trials/[id]`
- `/trials/[id]/feasibility`

## 9) Compliance and Audit
Tables:
- `audit_logs` (already exists)
- `access_policies` (id, org_id, policy_type, config_json, updated_at)
- `compliance_events` (id, org_id, event_type, severity, payload, created_at)

APIs:
- `GET /api/audit`
- `GET /api/compliance/events`
- `PATCH /api/compliance/policies/:id`

UI Screens:
- `/admin/audit`
- `/admin/compliance`
- `/admin/policies`

## Cross-Cutting Standards
- Every business table includes `created_at` and `updated_at`.
- Add RLS by `org_id` + member role checks.
- Soft delete for user-generated entities: `deleted_at`.
- API response envelope: `{ data, error, meta }`.
- Error taxonomy: validation, auth, permission, conflict, internal.

## Suggested Build Order
1. Auth + org membership
2. Studies + cohorts
3. Patient timeline + catalog
4. Analytics run pipeline
5. Trial feasibility
6. Compliance/audit dashboards
