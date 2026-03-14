import { fail, ok } from '@/lib/api/response';
import { requireAuth } from '@/lib/api/auth';
import { createOrgSchema } from '@/lib/validations/org';

export async function GET() {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, slug, created_by, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) return fail({ code: 'ORG_LIST_FAILED', message: error.message }, 400);
  return ok(data);
}

export async function POST(request: Request) {
  const { supabase, user } = await requireAuth();
  if (!user) return fail({ code: 'UNAUTHORIZED', message: 'You must be logged in.' }, 401);

  const body = await request.json().catch(() => null);
  const parsed = createOrgSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: 'VALIDATION_ERROR', message: 'Invalid organization payload.', details: parsed.error.flatten() }, 422);
  }

  const payload = {
    name: parsed.data.name,
    slug: parsed.data.slug,
    created_by: user.id,
  };

  const { data, error } = await supabase
    .from('organizations')
    .insert(payload)
    .select('id, name, slug, created_by, created_at, updated_at')
    .single();

  if (error) return fail({ code: 'ORG_CREATE_FAILED', message: error.message }, 400);

  const { error: membershipError } = await supabase.from('organization_members').insert({
    org_id: data.id,
    user_id: user.id,
    role: 'owner',
    status: 'active',
  });

  if (membershipError) return fail({ code: 'ORG_MEMBER_CREATE_FAILED', message: membershipError.message }, 400);
  return ok(data, undefined, 201);
}

