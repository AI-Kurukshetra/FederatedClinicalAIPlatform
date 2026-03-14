import Link from 'next/link';
import { AuthFormShell } from '@/components/common/AuthFormShell';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { JoinInviteClient } from './JoinInviteClient';
import styles from './page.module.css';

type JoinPageProps = {
  searchParams?: Promise<{
    token?: string;
  }>;
};

export default async function JoinPage({ searchParams }: JoinPageProps) {
  const params = (await searchParams) ?? {};
  const token = (params.token ?? '').trim();
  const nextPath = `/join${token ? `?token=${encodeURIComponent(token)}` : ''}`;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AuthFormShell
        eyebrow="Organization Invitation"
        title="Join an organization workspace"
        description="Sign in first, then accept your invite token to join the workspace."
      >
        <div className={styles.authActions}>
          <Link className={styles.primaryLink} href={`/login?next=${encodeURIComponent(nextPath)}`}>
            Sign in to continue
          </Link>
          <Link className={styles.secondaryLink} href={`/signup?next=${encodeURIComponent(nextPath)}`}>
            Create account
          </Link>
        </div>
      </AuthFormShell>
    );
  }

  return (
    <AuthFormShell
      eyebrow="Organization Invitation"
      title="Accept organization invite"
      description={`Signed in as ${user.email ?? 'your account'}. Paste invite token to join.`}
      footer={
        <span>
          Need a new invite? Ask your organization admin to create one from Account Settings.
        </span>
      }
    >
      <JoinInviteClient initialToken={token} />
    </AuthFormShell>
  );
}
