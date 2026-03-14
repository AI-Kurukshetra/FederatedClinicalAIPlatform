'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { encodeMessage, mapSupabaseAuthError } from '@/lib/auth/messages';

const updatePasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    confirmPassword: z.string().min(8, 'Confirm password is required.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export async function updatePasswordAction(formData: FormData) {
  const parsed = updatePasswordSchema.safeParse({
    password: String(formData.get('password') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? ''),
  });

  if (!parsed.success) {
    redirect(`/reset-password?error=${encodeMessage(parsed.error.issues[0]?.message ?? 'Invalid input.')}`);
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/login?error=' + encodeMessage('Reset session expired. Please request a new password reset link.'));
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    redirect(`/reset-password?error=${encodeMessage(mapSupabaseAuthError(error.message))}`);
  }

  await supabase.auth.signOut();
  redirect('/login?notice=' + encodeMessage('Password updated successfully. Please sign in with your new password.'));
}
