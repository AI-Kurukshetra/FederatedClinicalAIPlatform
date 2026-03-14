import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { encodeMessage } from '@/lib/auth/messages';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type') as 'signup' | 'invite' | 'recovery' | 'email_change' | 'email' | null;
  const next = requestUrl.searchParams.get('next') ?? '/auth/verified';

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeMessage('Invalid verification link. Please request a new email.')}`, requestUrl.origin)
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeMessage('Verification link expired or invalid. Please resend confirmation.')}`, requestUrl.origin)
    );
  }

  const safeNext = next.startsWith('/') ? next : '/auth/verified';
  const notice =
    type === 'recovery' ? 'Reset session verified. Set your new password now.' : 'Email verified successfully.';
  return NextResponse.redirect(new URL(`${safeNext}?notice=${encodeMessage(notice)}`, requestUrl.origin));
}
