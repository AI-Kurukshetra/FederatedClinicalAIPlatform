import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          service: 'auth',
          authenticated: false,
          error: error.message,
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      ok: true,
      service: 'auth',
      authenticated: Boolean(user),
      userId: user?.id ?? null,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: 'auth',
        authenticated: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
