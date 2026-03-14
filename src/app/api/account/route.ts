import { z } from 'zod';
import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import type { Database } from '@/types/database';

const accountUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  avatarUrl: z.string().trim().url().max(500).or(z.literal('')).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  locale: z.string().trim().min(2).max(24).optional(),
  timezone: z.string().trim().min(2).max(64).optional(),
});

export async function PATCH(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const body = await request.json().catch(() => null);
  const parsed = accountUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: 'VALIDATION_ERROR', message: 'Invalid account payload.', details: parsed.error.flatten() }, 422);
  }

  const { fullName, avatarUrl, theme, locale, timezone } = parsed.data;
  const shouldUpdateProfile = fullName !== undefined || avatarUrl !== undefined || timezone !== undefined;
  const shouldUpdatePreferences = theme !== undefined || locale !== undefined;

  if (!shouldUpdateProfile && !shouldUpdatePreferences) {
    return fail({ code: 'VALIDATION_ERROR', message: 'No account fields were provided.' }, 422);
  }

  if (shouldUpdateProfile) {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, timezone, email')
      .eq('id', user.id)
      .maybeSingle();

    const profilePayload: Database['public']['Tables']['profiles']['Insert'] = {
      id: user.id,
      email: existingProfile?.email ?? user.email ?? null,
      full_name: fullName !== undefined ? fullName.trim() || null : existingProfile?.full_name ?? null,
      avatar_url: avatarUrl !== undefined ? (avatarUrl === '' ? null : avatarUrl) : existingProfile?.avatar_url ?? null,
      timezone: timezone ?? existingProfile?.timezone ?? 'UTC',
    };

    const { error: profileError } = await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' });

    if (profileError) {
      return fail({ code: 'ACCOUNT_PROFILE_UPDATE_FAILED', message: profileError.message }, 400);
    }
  }

  if (shouldUpdatePreferences) {
    const { data: existingPreferences } = await supabase
      .from('user_preferences')
      .select('theme, locale')
      .eq('user_id', user.id)
      .maybeSingle();

    const { error: preferencesError } = await supabase.from('user_preferences').upsert(
      {
        user_id: user.id,
        theme: theme ?? existingPreferences?.theme ?? 'system',
        locale: locale ?? existingPreferences?.locale ?? 'en-US',
      },
      { onConflict: 'user_id' }
    );

    if (preferencesError) {
      return fail({ code: 'ACCOUNT_PREFERENCES_UPDATE_FAILED', message: preferencesError.message }, 400);
    }
  }

  const [profileRes, preferencesRes] = await Promise.all([
    supabase.from('profiles').select('full_name, email, avatar_url, timezone').eq('id', user.id).maybeSingle(),
    supabase.from('user_preferences').select('theme, locale').eq('user_id', user.id).maybeSingle(),
  ]);

  return ok({
    fullName: profileRes.data?.full_name ?? null,
    email: profileRes.data?.email ?? user.email ?? null,
    avatarUrl: profileRes.data?.avatar_url ?? null,
    timezone: profileRes.data?.timezone ?? 'UTC',
    theme: preferencesRes.data?.theme ?? 'system',
    locale: preferencesRes.data?.locale ?? 'en-US',
  });
}
