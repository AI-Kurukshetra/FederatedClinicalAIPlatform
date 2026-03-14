import Link from 'next/link';
import type { ReactNode } from 'react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ACTIVE_ORG_COOKIE } from '@/constants/cookies';
import { getPrimaryOrgContext, getOrgMemberships } from '@/server/services/org-context';
import { cookies } from 'next/headers';
import { AccountLauncher } from './AccountLauncher';
import styles from './AppShell.module.css';

type NavIconName =
  | 'dashboard'
  | 'studies'
  | 'cohorts'
  | 'dataSources'
  | 'nodes'
  | 'analytics'
  | 'askAi'
  | 'trialMatching'
  | 'reports'
  | 'audit'
  | 'compliance'
  | 'consent'
  | 'policies';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' as NavIconName },
  { href: '/studies', label: 'Studies', icon: 'studies' as NavIconName },
  { href: '/cohorts', label: 'Cohorts', icon: 'cohorts' as NavIconName },
  { href: '/data-sources', label: 'Data Sources', icon: 'dataSources' as NavIconName },
  { href: '/federated-nodes', label: 'Federated Nodes', icon: 'nodes' as NavIconName },
  { href: '/analytics', label: 'Analytics', icon: 'analytics' as NavIconName },
  { href: '/ask-ai', label: 'Ask AI', icon: 'askAi' as NavIconName },
  { href: '/clinical-trials/matching', label: 'Trial Matching', icon: 'trialMatching' as NavIconName },
  { href: '/reports', label: 'RWE Reports', icon: 'reports' as NavIconName },
  { href: '/admin/audit', label: 'Audit', icon: 'audit' as NavIconName },
  { href: '/admin/compliance', label: 'Compliance', icon: 'compliance' as NavIconName },
  { href: '/admin/consent', label: 'Consent', icon: 'consent' as NavIconName },
  { href: '/admin/policies', label: 'Policies', icon: 'policies' as NavIconName },
];

type AppShellProps = {
  children: ReactNode;
};

function NavIcon({ name }: { name: NavIconName }) {
  const baseProps = {
    viewBox: '0 0 24 24',
    width: 16,
    height: 16,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'dashboard':
      return (
        <svg {...baseProps}>
          <rect x="3" y="3" width="8" height="8" rx="1.6" />
          <rect x="13" y="3" width="8" height="5" rx="1.6" />
          <rect x="13" y="10" width="8" height="11" rx="1.6" />
          <rect x="3" y="13" width="8" height="8" rx="1.6" />
        </svg>
      );
    case 'studies':
      return (
        <svg {...baseProps}>
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M15 3v4h4" />
          <path d="M9 12h6M9 16h6" />
        </svg>
      );
    case 'cohorts':
      return (
        <svg {...baseProps}>
          <circle cx="8" cy="8" r="3" />
          <circle cx="16" cy="7" r="2.5" />
          <path d="M3.5 19c0-2.7 2-4.5 4.5-4.5S12.5 16.3 12.5 19" />
          <path d="M13 18.8c.2-1.8 1.5-3.3 3.5-3.3 1.8 0 3 .9 4 2.8" />
        </svg>
      );
    case 'dataSources':
      return (
        <svg {...baseProps}>
          <ellipse cx="12" cy="6" rx="7.5" ry="3.2" />
          <path d="M4.5 6v5c0 1.8 3.4 3.2 7.5 3.2s7.5-1.4 7.5-3.2V6" />
          <path d="M4.5 11v5c0 1.8 3.4 3.2 7.5 3.2s7.5-1.4 7.5-3.2v-5" />
        </svg>
      );
    case 'nodes':
      return (
        <svg {...baseProps}>
          <circle cx="5.5" cy="6" r="2.5" />
          <circle cx="18.5" cy="6" r="2.5" />
          <circle cx="12" cy="18" r="2.5" />
          <path d="M7.7 7.3l2.8 7.4M16.3 7.3l-2.8 7.4M8 6h8" />
        </svg>
      );
    case 'analytics':
      return (
        <svg {...baseProps}>
          <path d="M4 19V5M20 19H4" />
          <path d="m7 15 3-3 3 2 5-6" />
        </svg>
      );
    case 'askAi':
      return (
        <svg {...baseProps}>
          <path d="M12 3c-4.4 0-8 3-8 6.8 0 2.1 1.1 4 3 5.2V20l3.2-2.1c.6.1 1.2.2 1.8.2 4.4 0 8-3 8-6.8S16.4 3 12 3z" />
          <path d="M9.2 10.6h.01M12 10.6h.01M14.8 10.6h.01" />
        </svg>
      );
    case 'trialMatching':
      return (
        <svg {...baseProps}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-4.2-4.2M11 8v6M8 11h6" />
        </svg>
      );
    case 'reports':
      return (
        <svg {...baseProps}>
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v4h4" />
          <path d="M9 12h6M9 16h6" />
        </svg>
      );
    case 'audit':
      return (
        <svg {...baseProps}>
          <path d="M12 3 5 6v5.5c0 4.6 2.8 7.7 7 9.5 4.2-1.8 7-4.9 7-9.5V6z" />
          <path d="m9.2 11.8 1.9 1.9 3.8-3.8" />
        </svg>
      );
    case 'compliance':
      return (
        <svg {...baseProps}>
          <rect x="4" y="3.5" width="16" height="17" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
          <path d="m16.3 16.4 1.6 1.6 2.6-2.8" />
        </svg>
      );
    case 'consent':
      return (
        <svg {...baseProps}>
          <path d="M12 21s7-4.6 7-10V5l-7-2-7 2v6c0 5.4 7 10 7 10z" />
          <path d="m9.5 11.8 1.8 1.8 3.2-3.2" />
        </svg>
      );
    case 'policies':
      return (
        <svg {...baseProps}>
          <path d="M4.5 4.5h15v15h-15z" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      );
  }
}

export async function AppShell({ children }: AppShellProps) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const orgContext = user ? await getPrimaryOrgContext(supabase, user.id) : null;
  const orgMemberships = user ? await getOrgMemberships(supabase, user.id) : [];
  const [profileResult, preferencesResult] = user
    ? await Promise.all([
        supabase.from('profiles').select('full_name, avatar_url, timezone').eq('id', user.id).maybeSingle(),
        supabase.from('user_preferences').select('theme, locale').eq('user_id', user.id).maybeSingle(),
      ])
    : [{ data: null }, { data: null }];
  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  const userDisplayNameRaw = profileResult.data?.full_name ?? (typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null);
  const userDisplayName = userDisplayNameRaw?.trim() || user?.email?.split('@')[0] || 'Research User';
  const userEmail = user?.email ?? 'no-email@account.local';

  return (
    <div className={styles.shell}>
      <input id="app-sidebar-toggle" type="checkbox" className={styles.sidebarToggleInput} />

      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div>
            <div className={styles.brand}>Nference Research OS</div>
            <p className={styles.subBrand}>Federated Clinical AI for RWE</p>
          </div>
          <label htmlFor="app-sidebar-toggle" className={styles.sidebarToggleButton} aria-label="Toggle sidebar">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="m15 18-6-6 6-6" />
            </svg>
          </label>
        </div>

        <nav className={styles.nav} aria-label="Primary">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={styles.navLink}>
              <span className={styles.navIcon}>
                <NavIcon name={item.icon} />
              </span>
              <span className={styles.navText}>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <AccountLauncher
            fullName={userDisplayName}
            email={userEmail}
            workspaceName={orgContext?.orgName ?? 'No Organization Selected'}
            activeOrgId={activeOrgId ?? orgContext?.orgId}
            orgOptions={orgMemberships}
            initialAvatarUrl={profileResult.data?.avatar_url ?? null}
            initialTheme={preferencesResult.data?.theme ?? 'system'}
            initialLocale={preferencesResult.data?.locale ?? 'en-US'}
            initialTimezone={profileResult.data?.timezone ?? 'UTC'}
            triggerClassName={styles.footerLogo}
          />
          <div className={styles.footerDetails}>
            <span className={styles.orgName}>Workspace: {orgContext?.orgName ?? 'No Organization Selected'}</span>
            <span className={styles.userName}>{userDisplayName}</span>
          </div>
        </div>
      </aside>

      <label htmlFor="app-sidebar-toggle" className={styles.sidebarBackdrop} aria-hidden />

      <div className={styles.content}>
        <header className={styles.mobileTopbar}>
          <label htmlFor="app-sidebar-toggle" className={styles.mobileToggleButton} aria-label="Toggle sidebar">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </label>
          <span className={styles.mobileTitle}>Nference Research OS</span>
        </header>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
