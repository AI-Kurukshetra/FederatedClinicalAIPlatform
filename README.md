# Next.js + Supabase Production Starter

## What is included
- Scalable folder structure
- Environment variable template with client/server separation
- Central error classes
- Supabase browser/server/admin client skeleton
- Production-oriented migration (profiles, preferences, audit logs, triggers, RLS)
- Seed starter SQL
- CI workflow for lint, typecheck, test, build
- 8-hour implementation plan
- Supabase connection runbook

## Key files
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN_8H.md`
- `docs/SUPABASE_SETUP.md`
- `.env.example`
- `supabase/config.toml`
- `supabase/migrations/202603141100_init.sql`
- `.github/workflows/ci.yml`

## Next commands
1. Install Supabase CLI and link project.
2. Add env vars in `.env.local`.
3. Run `supabase db push`.
4. Generate DB types and replace manual type file.
5. Configure same env vars in Vercel and deploy.

## DB Commands (npm scripts)

### One-time setup
1. `npm run supabase:login`
2. `npm run supabase:link -- --project-ref <your-project-ref>`

### Local development flow
1. `npm run supabase:start`
2. `npm run db:migration:new -- <migration_name>`
3. Add SQL in `supabase/migrations/<timestamp>_<migration_name>.sql`
4. `npm run db:migration:up`
5. `npm run db:reset` (recreate local DB, run migrations, run seed)
6. `npm run db:types`

### Remote project flow
1. `npm run db:push` (apply local migrations to linked remote DB)
2. `npm run db:types` (refresh generated types from linked project)

### Extra commands
- `npm run supabase:status`
- `npm run supabase:stop`
- `npm run db:pull`
- `npm run db:seed` (seed-focused local reset)
