import Link from 'next/link';
import { AuthFormShell } from '@/components/common/AuthFormShell';
import { FlashToast } from '@/components/common/FlashToast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { decodeMessage } from '@/lib/auth/messages';
import { updatePasswordAction } from './actions';

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    error?: string;
    notice?: string;
  }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = (await searchParams) ?? {};
  const error = decodeMessage(params.error);
  const notice = decodeMessage(params.notice);

  return (
    <AuthFormShell
      eyebrow="Password Reset"
      title="Create a new password"
      description="Use a strong password with at least 8 characters."
      footer={
        <>
          Back to sign in: <Link href="/login">Login</Link>
        </>
      }
    >
      {error ? <FlashToast tone="error" message={error} title="Password update issue" /> : null}
      {notice ? <FlashToast tone="info" message={notice} title="Password reset update" /> : null}
      <form action={updatePasswordAction}>
        <Input
          id="password"
          name="password"
          type="password"
          label="New Password"
          minLength={8}
          placeholder="Enter new password"
          required
        />
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          label="Confirm Password"
          minLength={8}
          placeholder="Re-enter password"
          required
        />
        <Button size="lg" type="submit" style={{ marginTop: '0.85rem', width: '100%' }}>
          Update Password
        </Button>
      </form>
    </AuthFormShell>
  );
}
