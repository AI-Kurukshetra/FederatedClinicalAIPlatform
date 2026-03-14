# Phase 1 DB Apply + Verify

## Apply migration
In Supabase SQL Editor, run this file after `202603141100_init.sql`:
- `supabase/migrations/202603141230_phase1_org_studies_cohorts.sql`

## Quick verification SQL

```sql
-- 1) Tables exist
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'organizations',
    'organization_members',
    'invites',
    'studies',
    'study_members',
    'study_activity',
    'cohorts',
    'cohort_versions',
    'cohort_runs'
  )
order by table_name;

-- 2) RLS enabled
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'organizations',
    'organization_members',
    'invites',
    'studies',
    'study_members',
    'study_activity',
    'cohorts',
    'cohort_versions',
    'cohort_runs'
  )
order by tablename;

-- 3) Policies created
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'organizations',
    'organization_members',
    'invites',
    'studies',
    'study_members',
    'study_activity',
    'cohorts',
    'cohort_versions',
    'cohort_runs'
  )
order by tablename, policyname;
```

## First app-side write path to test
1. Create organization (owner = current user)
2. Insert org membership row for owner (`role='owner'`)
3. Create study under org
4. Create cohort and version
5. Create cohort run

If all pass, Phase 1 DB foundation is ready.
