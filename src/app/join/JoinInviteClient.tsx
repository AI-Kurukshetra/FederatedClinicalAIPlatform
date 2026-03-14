'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import styles from './page.module.css';

type JoinInviteClientProps = {
  initialToken: string;
};

type RedeemResponse = {
  data?: {
    orgId: string;
    orgName: string;
    role: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

export function JoinInviteClient({ initialToken }: JoinInviteClientProps) {
  const [token, setToken] = useState(initialToken);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ tone: 'idle' | 'success' | 'error'; message: string }>({
    tone: 'idle',
    message: '',
  });
  const attemptedAutoRedeem = useRef(false);

  async function redeemInvite(inviteToken: string) {
    const trimmed = inviteToken.trim();
    if (!trimmed) {
      setStatus({ tone: 'error', message: 'Invite token is required.' });
      return;
    }

    setIsSubmitting(true);
    setStatus({ tone: 'idle', message: '' });

    try {
      const response = await fetch('/api/org-invites/redeem', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: trimmed }),
      });

      const json = (await response.json().catch(() => null)) as RedeemResponse | null;

      if (response.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(`/join?token=${encodeURIComponent(trimmed)}`)}`;
        return;
      }

      if (!response.ok || !json?.data) {
        setStatus({
          tone: 'error',
          message: json?.error?.message ?? 'Unable to accept invite right now. Please try again.',
        });
        return;
      }

      const successMessage = `Joined ${json.data.orgName} as ${json.data.role}. Redirecting to dashboard...`;
      setStatus({ tone: 'success', message: successMessage });
      window.setTimeout(() => {
        window.location.href = `/dashboard?notice=${encodeURIComponent(successMessage)}`;
      }, 700);
    } catch {
      setStatus({ tone: 'error', message: 'Network error while accepting invite.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!initialToken || attemptedAutoRedeem.current) return;
    attemptedAutoRedeem.current = true;
    void redeemInvite(initialToken);
  }, [initialToken]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await redeemInvite(token);
  }

  return (
    <form onSubmit={handleSubmit} className={styles.joinForm}>
      <Input
        id="invite-token"
        name="token"
        label="Invite Token"
        value={token}
        onChange={(event) => setToken(event.target.value)}
        placeholder="Paste invitation token"
        required
      />
      <Button size="lg" type="submit" disabled={isSubmitting} style={{ width: '100%' }}>
        {isSubmitting ? 'Joining...' : 'Join Organization'}
      </Button>
      {status.message ? (
        <p className={`${styles.feedback} ${status.tone === 'error' ? styles.feedbackError : styles.feedbackSuccess}`}>
          {status.message}
        </p>
      ) : null}
    </form>
  );
}
