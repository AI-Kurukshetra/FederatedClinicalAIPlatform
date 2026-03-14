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
};

export function OrgSwitcher({ activeOrgId, options }: OrgSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!options.length) return null;

  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700 }}>Org</span>
      <select
        defaultValue={activeOrgId ?? options[0]?.orgId}
        disabled={isPending}
        style={{
          minWidth: '190px',
          height: '34px',
          borderRadius: '999px',
          border: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          color: 'var(--text-body)',
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
