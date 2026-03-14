'use server';

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { encodeMessage, isRateLimitAuthError, mapSupabaseAuthError } from '@/lib/auth/messages';
import { getAppUrl } from '@/lib/auth/url';
import { sendEmail } from '@/lib/email/mailer';
import { verificationEmailTemplate } from '@/lib/email/auth-templates';

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
  next: z.string().optional(),
});

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: String(formData.get('email') ?? '').toLowerCase(),
    password: String(formData.get('password') ?? ''),
    next: String(formData.get('next') ?? '/dashboard'),
  });
  if (!parsed.success) {
    redirect(`/login?error=${encodeMessage(parsed.error.issues[0]?.message ?? 'Invalid input.')}`);
  }

  const next = parsed.data.next ?? '/dashboard';

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (error.message.toLowerCase().includes('invalid login credentials')) {
      try {
        const admin = createAdminClient();
        const { data: userLookup } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const matched = userLookup?.users.find((user) => user.email?.toLowerCase() === parsed.data.email);
        if (matched && !matched.email_confirmed_at) {
          redirect(
            `/login?error=${encodeMessage(
              'Your email is not confirmed. Please verify your inbox and then sign in.'
            )}&email=${encodeMessage(parsed.data.email)}`
          );
        }
        if (!matched) {
          redirect(
            `/login?error=${encodeMessage(
              'No account found with this email. Please create an account first.'
            )}&email=${encodeMessage(parsed.data.email)}`
          );
        }
      } catch {
        // Fall through to generic error if service role key is unavailable.
      }
    }

    redirect(
      `/login?error=${encodeMessage(mapSupabaseAuthError(error.message))}&email=${encodeMessage(parsed.data.email)}`
    );
  }

  redirect(`${next.startsWith('/') ? next : '/dashboard'}?notice=${encodeMessage('Signed in successfully.')}`);
}

export async function resendConfirmationAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email) {
    redirect('/login?error=' + encodeMessage('Email is required to resend confirmation.'));
  }
  if (!password) {
    redirect(
      `/login?error=${encodeMessage('Password is required to resend verification email.')}&email=${encodeMessage(email)}`
    );
  }

  const admin = createAdminClient();
  const appUrl = await getAppUrl();
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: {
      redirectTo: `${appUrl}/auth/confirm?next=/auth/verified`,
    },
  });

  if (error) {
    if (isRateLimitAuthError(error.message)) {
      redirect(
        `/login?notice=${encodeMessage(
          'Verification email already sent recently. Please check inbox/spam and retry shortly.'
        )}&email=${encodeMessage(email)}`
      );
    }
    redirect(`/login?error=${encodeMessage(mapSupabaseAuthError(error.message))}&email=${encodeMessage(email)}`);
  }

  const actionLink = data.properties?.action_link;
  if (!actionLink) {
    redirect(`/login?error=${encodeMessage('Could not generate verification email. Please retry.')}&email=${encodeMessage(email)}`);
  }

  try {
    const template = verificationEmailTemplate(actionLink);
    await sendEmail({
      to: email,
      subject: 'Verify your Nference Research OS account',
      html: template.html,
      text: template.text,
    });
  } catch {
    redirect(
      `/login?error=${encodeMessage('Failed to send verification email. Please try again.')}&email=${encodeMessage(email)}`
    );
  }

  redirect(
    `/login?notice=${encodeMessage('Verification email sent again. Please check your inbox.')}&email=${encodeMessage(email)}`
  );
}
