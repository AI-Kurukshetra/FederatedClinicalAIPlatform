import Link from 'next/link';
import type { ReactNode } from 'react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ACTIVE_ORG_COOKIE } from '@/constants/cookies';
import { getPrimaryOrgContext, getOrgMemberships } from '@/server/services/org-context';
import { cookies } from 'next/headers';
import { OrgSwitcher } from './OrgSwitcher';
import { logoutAction } from './actions';
import styles from './AppShell.module.css';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/studies', label: 'Studies' },
  { href: '/cohorts', label: 'Cohorts' },
  { href: '/data-sources', label: 'Data Sources' },
  { href: '/federated-nodes', label: 'Federated Nodes' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/clinical-trials/matching', label: 'Trial Matching' },
  { href: '/admin/audit', label: 'Audit' },
  { href: '/admin/compliance', label: 'Compliance' },
];

type AppShellProps = {
  children: ReactNode;
};

export async function AppShell({ children }: AppShellProps) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const orgContext = user ? await getPrimaryOrgContext(supabase, user.id) : null;
  const orgMemberships = user ? await getOrgMemberships(supabase, user.id) : [];
  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>Nference Research OS</div>
        <p className={styles.subBrand}>Federated Clinical AI for RWE</p>
        <nav className={styles.nav} aria-label="Primary">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={styles.navLink}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className={styles.content}>
        <header className={styles.topbar}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span className={styles.orgName}>Workspace: {orgContext?.orgName ?? 'No Organization Selected'}</span>
            <OrgSwitcher options={orgMemberships} activeOrgId={activeOrgId ?? orgContext?.orgId} />
          </div>
          <div className={styles.actions}>
            <span className={styles.userChip}>{user?.email ?? 'Research User'}</span>
            <form action={logoutAction}>
              <button type="submit" className={styles.signOut}>
                Sign Out
              </button>
            </form>
          </div>
        </header>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
