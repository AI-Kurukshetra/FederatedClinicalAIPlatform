import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { ACTIVE_ORG_COOKIE } from '@/constants/cookies';

export async function POST(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const orgId = String(body?.orgId ?? '');
  if (!orgId) return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });

  const { data, error } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .is('deleted_at', null)
    .single();

  if (error || !data) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ACTIVE_ORG_COOKIE,
    value: orgId,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
