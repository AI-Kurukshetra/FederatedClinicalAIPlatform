'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { OrgSwitcher } from './OrgSwitcher';
import { logoutAction } from './actions';
import styles from './AccountLauncher.module.css';

type OrgOption = {
  orgId: string;
  orgName: string;
};

type JoinableOrg = {
  id: string;
  name: string;
  slug: string;
};

type ThemePreference = 'light' | 'dark' | 'system';

type AccountLauncherProps = {
  fullName: string;
  email: string;
  workspaceName: string;
  activeOrgId: string | undefined;
  orgOptions: OrgOption[];
  initialAvatarUrl: string | null;
  initialTheme: ThemePreference;
  initialLocale: string;
  initialTimezone: string;
  triggerClassName?: string;
};

type SaveState = {
  tone: 'idle' | 'success' | 'error';
  message: string;
};

type JoinState = {
  tone: 'idle' | 'success' | 'error';
  message: string;
};

export function AccountLauncher({
  fullName,
  email,
  workspaceName,
  activeOrgId,
  orgOptions,
  initialAvatarUrl,
  initialTheme,
  initialLocale,
  initialTimezone,
  triggerClassName,
}: AccountLauncherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [nameValue, setNameValue] = useState(fullName);
  const [avatarUrlValue, setAvatarUrlValue] = useState(initialAvatarUrl ?? '');
  const [themeValue, setThemeValue] = useState<ThemePreference>(initialTheme);
  const [localeValue, setLocaleValue] = useState(initialLocale);
  const [timezoneValue, setTimezoneValue] = useState(initialTimezone);
  const [saveState, setSaveState] = useState<SaveState>({ tone: 'idle', message: '' });
  const [joinableOrgs, setJoinableOrgs] = useState<JoinableOrg[]>([]);
  const [selectedJoinOrgId, setSelectedJoinOrgId] = useState('');
  const [isLoadingJoinable, setIsLoadingJoinable] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinState, setJoinState] = useState<JoinState>({ tone: 'idle', message: '' });

  const avatarFallback = useMemo(() => {
    const source = nameValue || fullName || email || 'R';
    return source.trim().charAt(0).toUpperCase();
  }, [nameValue, fullName, email]);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;

    async function loadJoinableOrganizations() {
      setIsLoadingJoinable(true);
      try {
        const response = await fetch('/api/orgs/joinable', { cache: 'no-store' });
        const json = (await response.json().catch(() => null)) as
          | {
              data?: JoinableOrg[];
              error?: { message?: string };
            }
          | null;

        if (!active) return;

        if (!response.ok) {
          setJoinableOrgs([]);
          setSelectedJoinOrgId('');
          setJoinState({
            tone: 'error',
            message: json?.error?.message ?? 'Could not load organizations right now.',
          });
          return;
        }

        const orgs = json?.data ?? [];
        setJoinableOrgs(orgs);
        setSelectedJoinOrgId((prev) => {
          if (prev && orgs.some((org) => org.id === prev)) return prev;
          return orgs[0]?.id ?? '';
        });
      } catch {
        if (!active) return;
        setJoinableOrgs([]);
        setSelectedJoinOrgId('');
        setJoinState({ tone: 'error', message: 'Network error while loading organizations.' });
      } finally {
        if (active) setIsLoadingJoinable(false);
      }
    }

    void loadJoinableOrganizations();
    return () => {
      active = false;
    };
  }, [isOpen, orgOptions.length]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setSaveState({ tone: 'idle', message: '' });

    try {
      const response = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName: nameValue,
          avatarUrl: avatarUrlValue,
          theme: themeValue,
          locale: localeValue,
          timezone: timezoneValue,
        }),
      });

      const json = (await response.json().catch(() => null)) as
        | {
            error?: { message?: string };
          }
        | null;

      if (!response.ok) {
        setSaveState({
          tone: 'error',
          message: json?.error?.message ?? 'Could not save account settings. Please try again.',
        });
        return;
      }

      setSaveState({ tone: 'success', message: 'Account settings updated successfully.' });
    } catch {
      setSaveState({ tone: 'error', message: 'Network error while saving account settings.' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleQuickJoinOrganization() {
    if (!selectedJoinOrgId) {
      setJoinState({ tone: 'error', message: 'Select an organization first.' });
      return;
    }

    setIsJoining(true);
    setJoinState({ tone: 'idle', message: '' });

    try {
      const response = await fetch('/api/orgs/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgId: selectedJoinOrgId }),
      });

      const json = (await response.json().catch(() => null)) as
        | {
            data?: { orgName?: string };
            error?: { message?: string };
          }
        | null;

      if (response.status === 401) {
        window.location.href = '/login?next=/dashboard';
        return;
      }

      if (!response.ok) {
        setJoinState({
          tone: 'error',
          message: json?.error?.message ?? 'Unable to join organization right now.',
        });
        return;
      }

      const orgName = json?.data?.orgName ?? 'organization';
      const notice = `Joined ${orgName} successfully.`;
      window.location.href = `/dashboard?notice=${encodeURIComponent(notice)}`;
    } catch {
      setJoinState({ tone: 'error', message: 'Network error while joining organization.' });
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.triggerButton}${triggerClassName ? ` ${triggerClassName}` : ''}`}
        onClick={() => {
          setSaveState({ tone: 'idle', message: '' });
          setJoinState({ tone: 'idle', message: '' });
          setIsOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Open account settings"
      >
        {avatarFallback}
      </button>

      {isOpen ? (
        <div className={styles.modalRoot} role="dialog" aria-modal="true" aria-labelledby="account-settings-title">
          <button type="button" className={styles.backdrop} aria-label="Close account settings" onClick={() => setIsOpen(false)} />

          <section className={styles.modal}>
            <header className={styles.header}>
              <div>
                <p className={styles.kicker}>My Account</p>
                <h2 id="account-settings-title" className={styles.title}>
                  Account Settings
                </h2>
                <p className={styles.subtitle}>
                  Workspace: {workspaceName} | {email}
                </p>
              </div>
              <button type="button" className={styles.closeButton} onClick={() => setIsOpen(false)} aria-label="Close account modal">
                x
              </button>
            </header>

            <form className={styles.form} onSubmit={handleSave}>
              <section className={styles.section}>
                <h3>Appearance</h3>
                <div className={styles.themeRow}>
                  {(['system', 'light', 'dark'] as const).map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      className={`${styles.themeChip}${themeValue === theme ? ` ${styles.themeChipActive}` : ''}`}
                      onClick={() => setThemeValue(theme)}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.section}>
                <h3>Workspace</h3>
                <div className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>Active Organization</span>
                  <div id="account-org-switcher" className={styles.switcherWrap}>
                    <OrgSwitcher activeOrgId={activeOrgId} options={orgOptions} />
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>Join Seeded Organization</span>
                  <div className={styles.quickJoinRow}>
                    <select
                      className={styles.quickJoinSelect}
                      value={selectedJoinOrgId}
                      onChange={(event) => setSelectedJoinOrgId(event.target.value)}
                      disabled={isLoadingJoinable || joinableOrgs.length === 0}
                    >
                      {joinableOrgs.length === 0 ? (
                        <option value="">{isLoadingJoinable ? 'Loading organizations...' : 'No organization available to join'}</option>
                      ) : (
                        joinableOrgs.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name}
                          </option>
                        ))
                      )}
                    </select>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      disabled={isJoining || isLoadingJoinable || !selectedJoinOrgId}
                      onClick={() => void handleQuickJoinOrganization()}
                    >
                      {isJoining ? 'Joining...' : 'Join'}
                    </button>
                  </div>
                </div>

                {joinState.message ? (
                  <p className={`${styles.message}${joinState.tone === 'error' ? ` ${styles.error}` : ` ${styles.success}`}`}>{joinState.message}</p>
                ) : null}
              </section>

              <section className={styles.section}>
                <h3>Profile</h3>
                <div className={styles.grid}>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="account-full-name">Full Name</label>
                    <input
                      id="account-full-name"
                      value={nameValue}
                      onChange={(event) => setNameValue(event.target.value)}
                      autoComplete="name"
                      required
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="account-email">Email</label>
                    <input id="account-email" value={email} readOnly disabled />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="account-avatar-url">Avatar URL</label>
                    <input
                      id="account-avatar-url"
                      value={avatarUrlValue}
                      onChange={(event) => setAvatarUrlValue(event.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="account-timezone">Timezone</label>
                    <input
                      id="account-timezone"
                      value={timezoneValue}
                      onChange={(event) => setTimezoneValue(event.target.value)}
                      placeholder="UTC"
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="account-locale">Locale</label>
                    <input id="account-locale" value={localeValue} onChange={(event) => setLocaleValue(event.target.value)} placeholder="en-US" />
                  </div>
                </div>
              </section>

              {saveState.message ? (
                <p className={`${styles.message}${saveState.tone === 'error' ? ` ${styles.error}` : ` ${styles.success}`}`}>{saveState.message}</p>
              ) : null}

              <div className={styles.actions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setIsOpen(false)}>
                  Close
                </button>
                <button type="submit" className={styles.primaryButton} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>

            <div className={styles.footer}>
              <span className={styles.planChip}>Free Plan</span>
              <form action={logoutAction}>
                <button type="submit" className={styles.signOutButton}>
                  Sign Out
                </button>
              </form>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
