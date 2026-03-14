import Link from 'next/link';
import { AuthFormShell } from '@/components/common/AuthFormShell';
import { FlashToast } from '@/components/common/FlashToast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { decodeMessage } from '@/lib/auth/messages';
import { forgotPasswordAction } from './actions';

type ForgotPasswordPageProps = {
  searchParams?: Promise<{
    error?: string;
    notice?: string;
    email?: string;
  }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = (await searchParams) ?? {};
  const error = decodeMessage(params.error);
  const notice = decodeMessage(params.notice);
  const email = decodeMessage(params.email);

  return (
    <AuthFormShell
      eyebrow="Password Recovery"
      title="Reset your password"
      description="Enter your email and we will send a secure password reset link."
      footer={
        <>
          Back to sign in: <Link href="/login">Login</Link>
        </>
      }
    >
      {error ? <FlashToast tone="error" message={error} title="Password reset issue" /> : null}
      {notice ? <FlashToast tone="info" message={notice} title="Password reset update" /> : null}
      <form action={forgotPasswordAction}>
        <Input
          id="email"
          name="email"
          type="email"
          label="Work Email"
          defaultValue={email}
          placeholder="name@hospital.org"
          required
        />
        <Button size="lg" type="submit" style={{ marginTop: '0.85rem', width: '100%' }}>
          Send Reset Link
        </Button>
      </form>
    </AuthFormShell>
  );
}
