'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { encodeMessage, isRateLimitAuthError, mapSupabaseAuthError } from '@/lib/auth/messages';
import { getAppUrl } from '@/lib/auth/url';
import { sendEmail } from '@/lib/email/mailer';
import { verificationEmailTemplate } from '@/lib/email/auth-templates';

const signupSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters.'),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

export async function signupAction(formData: FormData) {
  const parsed = signupSchema.safeParse({
    fullName: String(formData.get('fullName') ?? ''),
    email: String(formData.get('email') ?? '').toLowerCase(),
    password: String(formData.get('password') ?? ''),
  });
  if (!parsed.success) {
    redirect(`/signup?error=${encodeMessage(parsed.error.issues[0]?.message ?? 'Invalid input.')}`);
  }

  const admin = createAdminClient();
  const appUrl = await getAppUrl();
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'signup',
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      redirectTo: `${appUrl}/auth/confirm?next=/auth/verified`,
      data: {
        full_name: parsed.data.fullName,
      },
    },
  });

  if (error) {
    if (isRateLimitAuthError(error.message)) {
      redirect(
        `/login?notice=${encodeMessage(
          'Verification email was sent recently. Please check inbox/spam and try again in about a minute.'
        )}&email=${encodeMessage(parsed.data.email)}`
      );
    }
    redirect(`/signup?error=${encodeMessage(mapSupabaseAuthError(error.message))}`);
  }

  const actionLink = data.properties?.action_link;
  if (!actionLink) {
    redirect(`/signup?error=${encodeMessage('Could not generate verification link. Please retry.')}`);
  }

  try {
    const template = verificationEmailTemplate(actionLink);
    await sendEmail({
      to: parsed.data.email,
      subject: 'Verify your Nference Research OS account',
      html: template.html,
      text: template.text,
    });
  } catch {
    redirect(`/signup?error=${encodeMessage('Failed to send verification email. Please try again.')}`);
  }

  redirect(
    `/login?notice=${encodeMessage(
      'Verification email sent successfully. Open your inbox and click the verification link.'
    )}&email=${encodeMessage(parsed.data.email)}`
  );
}
