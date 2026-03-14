# 8-Hour Execution Plan (Production-Grade MVP)

Assumption: You are building a secure web app baseline with auth + profile + one core domain module.

## Phase 0 (0:00 - 0:30) Project Foundation
Deliverables:
- Initialize Next.js app (App Router, TypeScript, ESLint).
- Install core deps: Supabase SSR, Zod, React Hook Form, testing libs.
- Setup aliases and strict TypeScript settings.

Checklist:
- `npm create next-app@latest`
- Configure `tsconfig` paths
- Add `.env.example`

## Phase 1 (0:30 - 1:45) Supabase + Auth Base
Deliverables:
- Supabase project ready.
- Auth flow skeleton (sign-in, sign-up, sign-out).
- Middleware-based route protection.

Checklist:
- Add `src/lib/supabase/client.ts` and `server.ts`
- Add auth route group in `src/app/(auth)`
- Add protected dashboard route group

## Phase 2 (1:45 - 3:00) Data Model + Migrations
Deliverables:
- Initial DB schema via SQL migrations.
- Row-Level Security (RLS) policies.
- Seed data for local/dev.

Checklist:
- Create timestamped migration files in `supabase/migrations`
- Define indexes and constraints early
- Add policy tests manually using SQL queries

## Phase 3 (3:00 - 4:30) Feature Layer + Reusable Components
Deliverables:
- One complete domain feature (CRUD or equivalent).
- Reusable UI primitives and form components.
- Validation + error mapping.

Checklist:
- Keep domain logic in `src/features/<feature>/server`
- Shared DTO/types in `src/types`
- Zod validation schemas in `src/lib/validations`

## Phase 4 (4:30 - 5:30) Reliability and Quality Gates
Deliverables:
- Central error model + error boundaries.
- Basic logging and typed responses.
- Unit tests for critical utilities and service logic.

Checklist:
- `AppError` base class and mapped error codes
- Tests for auth guard, validation, mapper functions

## Phase 5 (5:30 - 6:45) Vercel Deployment Hardening
Deliverables:
- Vercel project connected to Git.
- Env vars configured for Preview + Production.
- CI workflow for lint/typecheck/test/build.

Checklist:
- Add `.github/workflows/ci.yml`
- Verify build on pull request
- Add production URL to Supabase redirect settings

## Phase 6 (6:45 - 8:00) Final Verification + Launch Readiness
Deliverables:
- Manual smoke test passes.
- Security + performance quick audit.
- Release checklist complete.

Checklist:
- Auth flows tested end-to-end
- Protected routes validated
- Error and empty states checked
- Rollback plan documented

## Definition of Done
- Build passes locally and in CI.
- No TypeScript errors.
- Core flow works with authenticated user.
- DB changes fully migration-driven.
- Deployment successful on Vercel with correct env vars.
