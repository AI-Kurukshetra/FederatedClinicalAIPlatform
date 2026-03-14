import { createAdminClient } from '@/lib/supabase/admin';

type AuditPayload = {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(payload: AuditPayload) {
  try {
    const admin = createAdminClient();
    await admin.from('audit_logs').insert({
      actor_id: payload.actorId ?? null,
      action: payload.action,
      entity: payload.entity,
      entity_id: payload.entityId ?? null,
      metadata: payload.metadata ?? {},
    });
  } catch {
    // Never fail user flows due to audit logging issues.
  }
}
