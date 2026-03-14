'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { OrgSwitcher } from './OrgSwitcher';
import { logoutAction } from './actions';
import styles from './AccountLauncher.module.css';

type OrgOption = {
  orgId: string;
  orgName: string;
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

  const avatarFallback = useMemo(() => {
    const source = nameValue || fullName || email || 'R';
    return source.trim().charAt(0).toUpperCase();
  }, [nameValue, fullName, email]);

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

  return (
    <>
      <button
        type="button"
        className={`${styles.triggerButton}${triggerClassName ? ` ${triggerClassName}` : ''}`}
        onClick={() => {
          setSaveState({ tone: 'idle', message: '' });
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
