'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

type OrgOption = {
  orgId: string;
  orgName: string;
};

type OrgSwitcherProps = {
  activeOrgId: string | undefined;
  options: OrgOption[];
  tone?: 'light' | 'dark';
};

export function OrgSwitcher({ activeOrgId, options, tone = 'light' }: OrgSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isDark = tone === 'dark';

  if (!options.length) return null;

  return (
    <label
      style={
        isDark
          ? { display: 'grid', gap: '0.3rem' }
          : { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }
      }
    >
      <span style={{ fontSize: '0.78rem', color: isDark ? '#aac3de' : 'var(--text-muted)', fontWeight: 700 }}>Org</span>
      <select
        defaultValue={activeOrgId ?? options[0]?.orgId}
        disabled={isPending}
        style={{
          minWidth: isDark ? '100%' : '190px',
          width: isDark ? '100%' : 'auto',
          height: '34px',
          borderRadius: isDark ? '10px' : '999px',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid var(--border-default)',
          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'var(--bg-surface)',
          color: isDark ? '#e5f0ff' : 'var(--text-body)',
          padding: '0 0.7rem',
          fontWeight: 600,
        }}
        onChange={(event) => {
          const orgId = event.target.value;
          startTransition(async () => {
            await fetch('/api/org-context', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ orgId }),
            });
            router.refresh();
          });
        }}
      >
        {options.map((option) => (
          <option key={option.orgId} value={option.orgId}>
            {option.orgName}
          </option>
        ))}
      </select>
    </label>
  );
}
