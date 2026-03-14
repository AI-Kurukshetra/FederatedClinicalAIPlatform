# Production Blueprint (Next.js + Supabase + Vercel)

This repository now contains a scalable foundation intended for long-term growth.

## Directory Structure

```text
src/
  app/
    (public)/
    (auth)/
    (dashboard)/
    api/
  components/
    ui/
    common/
    layout/
    forms/
  features/
    auth/
      components/
      server/
    profile/
      components/
      server/
  lib/
    config/
    errors/
    supabase/
    utils/
    validations/
  constants/
  types/
  server/
    services/
    repositories/
    mappers/
    policies/
  styles/
  tests/
    unit/
    integration/

supabase/
  migrations/
  seed/

docs/
.github/workflows/
```

## Architecture Rules
- Keep route-level code in `src/app`, business code in `src/features`.
- Put reusable UI in `src/components/ui`; feature-specific UI stays under each feature.
- All external clients (Supabase, etc.) are initialized in `src/lib` only.
- Server-only logic goes to `src/server` or `feature/server`.
- Centralize constants, types, and validation schemas.
- Use SQL migrations under `supabase/migrations` and never edit schema manually in production.

## Deployment Model
- Host on Vercel.
- Managed Postgres/Auth/Storage on Supabase.
- Environment variables managed in Vercel project settings.
- CI pipeline runs lint, type-check, test, and build before deploy.
