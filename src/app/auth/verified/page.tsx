import { decodeMessage } from '@/lib/auth/messages';
import { VerifiedClient } from './VerifiedClient';

type VerifiedPageProps = {
  searchParams?: Promise<{
    notice?: string;
  }>;
};

export default async function VerifiedPage({ searchParams }: VerifiedPageProps) {
  const params = (await searchParams) ?? {};
  const notice = decodeMessage(params.notice) || 'Your email is verified. You can now sign in securely.';

  return <VerifiedClient message={notice} />;
}
