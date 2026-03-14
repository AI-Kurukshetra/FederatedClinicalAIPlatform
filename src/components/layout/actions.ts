'use server';

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { encodeMessage } from '@/lib/auth/messages';

export async function logoutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect('/login?notice=' + encodeMessage('Signed out successfully.'));
}
