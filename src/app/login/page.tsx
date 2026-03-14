import Link from 'next/link';
import { AuthFormShell } from '@/components/common/AuthFormShell';
import { FlashToast } from '@/components/common/FlashToast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { decodeMessage } from '@/lib/auth/messages';
import { loginAction, resendConfirmationAction } from './actions';
import styles from './page.module.css';

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    notice?: string;
    next?: string;
    email?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const error = decodeMessage(params.error);
  const notice = decodeMessage(params.notice);
  const nextPath = params.next ?? '/dashboard';
  const email = decodeMessage(params.email);
  const showResend = error.toLowerCase().includes('not confirmed');

  return (
    <AuthFormShell
      eyebrow="Secure Access"
      title="Sign in to your research workspace"
      description="Access federated studies, cohort operations, and compliance dashboards."
      footer={
        <>
          New to the platform? <Link href="/signup">Create an account</Link>
        </>
      }
    >
      {error ? <FlashToast tone="error" message={error} title="Sign-in issue" /> : null}
      {notice ? <FlashToast tone="success" message={notice} title="Sign-in update" /> : null}
      <form action={loginAction}>
        <input type="hidden" name="next" value={nextPath} />
        <Input
          id="email"
          name="email"
          type="email"
          label="Work Email"
          defaultValue={email}
          placeholder="name@hospital.org"
          required
        />
        <Input
          id="password"
          name="password"
          type="password"
          label="Password"
          placeholder="Enter password"
          required
        />
        <Button size="lg" type="submit" style={{ marginTop: '0.85rem', width: '100%' }}>
          Sign In
        </Button>
      </form>
      {showResend ? (
        <form action={resendConfirmationAction}>
          <input type="hidden" name="email" value={email} />
          <Input
            id="resendPassword"
            name="password"
            type="password"
            label="Password (for resend verification)"
            placeholder="Enter your password again"
            required
          />
          <Button type="submit" variant="ghost" style={{ width: '100%', marginTop: '0.5rem' }}>
            Resend confirmation email
          </Button>
        </form>
      ) : null}
      <p className={styles.helperLink}>
        Forgot password? <Link href="/forgot-password">Reset it</Link>
      </p>
    </AuthFormShell>
  );
}
