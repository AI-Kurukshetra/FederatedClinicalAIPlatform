# Supabase Setup Runbook

## 1) Install Supabase CLI
Use one of these:

```powershell
npm install -g supabase
```

or

```powershell
scoop install supabase
```

## 2) Authenticate and link project

```powershell
supabase login
supabase link --project-ref <your-project-ref>
```

`<your-project-ref>` is the project id from your Supabase URL: `https://<project-ref>.supabase.co`.

## 3) Configure environment variables
Copy `.env.example` to `.env.local` and fill values from Supabase Project Settings.

Required values:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 4) Apply migrations to remote database

```powershell
supabase db push
```

## 5) (Optional) Run local Supabase stack

```powershell
supabase start
supabase db reset
```

## 6) Generate TypeScript types after schema changes

```powershell
supabase gen types typescript --linked > src/types/database.generated.ts
```

Then replace manual `src/types/database.ts` with generated types when your schema stabilizes.

## 7) Vercel setup
Add the same env vars in Vercel for:
- Production
- Preview
- Development

Then deploy.
