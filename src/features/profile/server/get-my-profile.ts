import type { Database } from '@/types/database';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function getMyProfile() {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .single<Database['public']['Tables']['profiles']['Row']>();

  if (error) throw error;
  return data;
}
