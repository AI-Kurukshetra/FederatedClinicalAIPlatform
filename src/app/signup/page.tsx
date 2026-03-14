import Link from 'next/link';
import { AuthFormShell } from '@/components/common/AuthFormShell';
import { FlashToast } from '@/components/common/FlashToast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { decodeMessage } from '@/lib/auth/messages';
import { signupAction } from './actions';

type SignupPageProps = {
  searchParams?: Promise<{
    error?: string;
    notice?: string;
    email?: string;
  }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = (await searchParams) ?? {};
  const error = decodeMessage(params.error);
  const notice = decodeMessage(params.notice);
  const email = decodeMessage(params.email);

  return (
    <AuthFormShell
      eyebrow="Account Setup"
      title="Create your platform account"
      description="Start securely collaborating on RWE studies across federated healthcare networks."
      footer={
        <>
          Already have an account? <Link href="/login">Sign in</Link>
        </>
      }
    >
      {error ? <FlashToast tone="error" message={error} title="Sign-up issue" /> : null}
      {notice ? <FlashToast tone="info" message={notice} title="Sign-up update" /> : null}
      <form action={signupAction}>
        <Input id="fullName" name="fullName" type="text" label="Full Name" placeholder="Jane Doe" required />
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
          placeholder="Create password"
          minLength={8}
          required
        />
        <Button size="lg" type="submit" style={{ marginTop: '0.85rem', width: '100%' }}>
          Create Account
        </Button>
      </form>
    </AuthFormShell>
  );
}
