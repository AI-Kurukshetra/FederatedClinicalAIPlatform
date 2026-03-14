# Phase 1 UI Backlog (Federated Clinical AI Platform)

Date: March 14, 2026
Scope: UI foundation and first product-facing screens aligned to RWE + federated clinical workflows.

## Product Goal Alignment
- Build a secure, multi-tenant research workspace for institutions, studies, and cohort operations.
- Keep compliance, auditability, and role-aware access as first-class UX constraints.
- Use Next.js + Supabase only.

## Screen Inventory (MVP Track)
1. `/` Landing page
2. `/login`
3. `/signup`
4. `/onboarding/create-org`
5. `/dashboard`
6. `/studies`
7. `/studies/[id]`
8. `/studies/[id]/settings`
9. `/cohorts`
10. `/cohorts/new`
11. `/cohorts/[id]`
12. `/cohorts/[id]/builder`
13. `/data-sources`
14. `/federated-nodes`
15. `/analytics`
16. `/clinical-trials/matching`
17. `/admin/audit`
18. `/admin/compliance`

## Phase 1 Tickets (Now)

### UI-001 Design Tokens + Visual Baseline
- Deliver:
  - Global CSS variables for color, spacing, radius, shadows, and typography scale.
  - Consistent light theme with clinical/research tone.
- Acceptance:
  - No page-level hardcoded random colors for primary surfaces/actions.
  - All new screens use shared tokens.

### UI-002 Core Reusable Components
- Deliver:
  - `Button` with variants and sizes.
  - `Input` with label and message state.
  - `Card` for section blocks and metrics.
- Acceptance:
  - Components are typed and reusable.
  - Components render correctly on mobile and desktop.

### UI-003 App Shell for Protected Workspace
- Deliver:
  - Sidebar navigation for workspace areas.
  - Topbar with organization context area + user actions placeholder.
  - Content container with responsive behavior.
- Acceptance:
  - Works from `1024px+` (sidebar fixed) and `<1024px` (stacked layout).
  - Dashboard route is ready for feature pages.

### UI-004 Auth Screens (Initial)
- Deliver:
  - `/login` screen with credential form and next-step links.
  - `/signup` screen with account creation form pattern.
- Acceptance:
  - Visual consistency with landing + app shell style language.
  - Clear validation message placeholder states.

### UI-005 Dashboard Entry Screen
- Deliver:
  - `/dashboard` page with key cards:
    - Active studies
    - Cohort definitions
    - Recent runs
    - Compliance status
  - Primary CTA links to studies/cohorts.
- Acceptance:
  - Responsive card grid.
  - No console/runtime errors on build.

## API Mapping (Current Backend)

### Organizations
- `GET /api/orgs`
- `POST /api/orgs`
- `GET /api/orgs/:orgId/members`
- `POST /api/orgs/:orgId/members`
- UI usage:
  - Onboarding org creation
  - Members management

### Studies
- `GET /api/studies`
- `POST /api/studies`
- `PATCH /api/studies/:id`
- UI usage:
  - Studies list
  - Study details/settings

### Cohorts
- `GET /api/cohorts?orgId=<uuid>&limit=&offset=`
- `POST /api/cohorts`
- `POST /api/cohorts/:id/versions`
- `POST /api/cohorts/:id/run`
- UI usage:
  - Cohort list/detail
  - Cohort builder/version publish
  - Cohort execution

## Out of Scope for Phase 1
- Full federated training orchestration UI.
- Advanced analytics visuals (D3/Plotly-level).
- Regulatory package generation flows.

## Definition of Done (Phase 1)
- Shared component baseline is in place and used by screens.
- Auth and dashboard pages are production-styled, responsive, and navigable.
- Build succeeds without introducing type errors.
