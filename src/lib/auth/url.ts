import { headers } from 'next/headers';
import { clientEnv } from '@/lib/config/env.client';

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export async function getAppUrl() {
  const headerStore = await headers();
  const origin = headerStore.get('origin');
  if (origin) return trimTrailingSlash(origin);

  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host');
  const proto = headerStore.get('x-forwarded-proto') ?? 'https';
  if (host) return `${proto}://${host}`;

  if (clientEnv.NEXT_PUBLIC_APP_URL) return trimTrailingSlash(clientEnv.NEXT_PUBLIC_APP_URL);

  return 'http://localhost:3000';
}
