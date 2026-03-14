# Phase 1 API Endpoints

All endpoints return `{ data, error, meta }`.

## Organizations
- `GET /api/orgs`
- `POST /api/orgs`
  - body: `{ "name": "Acme Health", "slug": "acme-health" }`

## Organization Members
- `GET /api/orgs/{orgId}/members`
- `POST /api/orgs/{orgId}/members`
  - body: `{ "userId": "<uuid>", "role": "researcher", "status": "active" }`

## Studies
- `GET /api/studies?orgId=<uuid>&limit=20&offset=0`
- `POST /api/studies`
  - body: `{ "orgId": "<uuid>", "name": "Lung RWE Study", "description": "...", "status": "draft" }`
- `GET /api/studies/{id}`
- `PATCH /api/studies/{id}`
  - body: `{ "name": "Updated Name", "status": "active" }`

## Cohorts
- `GET /api/cohorts?orgId=<uuid>&limit=20&offset=0`
- `POST /api/cohorts`
  - body: `{ "orgId": "<uuid>", "studyId": "<uuid>", "name": "Stage IV", "description": "..." }`
- `POST /api/cohorts/{id}/versions`
  - body: `{ "versionNo": 1, "definitionJson": { "rules": [] } }`
- `POST /api/cohorts/{id}/run`
  - body optional: `{ "cohortVersionId": "<uuid>" }`

## Auth Requirement
All routes require logged-in user (Supabase session cookie). RLS enforces org-level access.
