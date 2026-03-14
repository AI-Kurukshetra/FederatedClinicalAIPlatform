'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type VerifiedClientProps = {
  message: string;
};

export function VerifiedClient({ message }: VerifiedClientProps) {
  const router = useRouter();

  useEffect(() => {
    const id = window.setTimeout(() => router.push('/login?notice=' + encodeURIComponent('Email verified. Please sign in.')), 3500);
    return () => window.clearTimeout(id);
  }, [router]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '1rem',
      }}
    >
      <Card title="Email verification complete" description={message} className="">
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <Link href="/login">
            <Button size="lg" style={{ width: '100%' }}>
              Go to Login
            </Button>
          </Link>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Redirecting automatically in a few seconds.
          </p>
        </div>
      </Card>
    </main>
  );
}
