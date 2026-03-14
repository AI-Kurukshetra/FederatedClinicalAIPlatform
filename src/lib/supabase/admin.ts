import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { clientEnv } from '@/lib/config/env.client';
import { requireServiceRoleKey } from '@/lib/config/env.server';

export function createAdminClient() {
  return createClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, requireServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
