'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { encodeMessage } from '@/lib/auth/messages';
import { getAppUrl } from '@/lib/auth/url';
import { sendEmail } from '@/lib/email/mailer';
import { resetPasswordEmailTemplate } from '@/lib/email/auth-templates';

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
});

export async function forgotPasswordAction(formData: FormData) {
  const parsed = forgotPasswordSchema.safeParse({
    email: String(formData.get('email') ?? '').toLowerCase(),
  });

  if (!parsed.success) {
    redirect(`/forgot-password?error=${encodeMessage(parsed.error.issues[0]?.message ?? 'Invalid input.')}`);
  }

  const admin = createAdminClient();
  const appUrl = await getAppUrl();
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: parsed.data.email,
    options: {
      redirectTo: `${appUrl}/auth/confirm?next=/reset-password`,
    },
  });

  if (error) {
    // Keep generic output to avoid disclosing account existence.
    redirect(
      `/forgot-password?notice=${encodeMessage(
        'If this email exists, a password reset link has been sent.'
      )}&email=${encodeMessage(parsed.data.email)}`
    );
  }

  const actionLink = data.properties?.action_link;
  if (actionLink) {
    try {
      const template = resetPasswordEmailTemplate(actionLink);
      await sendEmail({
        to: parsed.data.email,
        subject: 'Reset your Nference Research OS password',
        html: template.html,
        text: template.text,
      });
    } catch {
      redirect(`/forgot-password?error=${encodeMessage('Failed to send reset email. Please try again.')}`);
    }
  }

  redirect(
    `/forgot-password?notice=${encodeMessage(
      'If this email exists, a password reset link has been sent.'
    )}&email=${encodeMessage(parsed.data.email)}`
  );
}
