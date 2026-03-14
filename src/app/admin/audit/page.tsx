import { Card } from '@/components/ui/Card';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getPrimaryOrgContext } from '@/server/services/org-context';
import styles from '../../workspace.module.css';

type AuditLogRow = {
  id: number;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function formatAction(value: string) {
  return value.replaceAll('_', ' ').replaceAll('.', ' ');
}

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

type AuditPageProps = {
  searchParams?: Promise<{
    range?: string;
    entity?: string;
  }>;
};

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const params = (await searchParams) ?? {};
  const range = params.range === '24h' || params.range === '7d' || params.range === '30d' ? params.range : '7d';
  const entityFilter = params.entity ?? 'all';

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const orgContext = user ? await getPrimaryOrgContext(supabase, user.id) : null;

  const admin = createAdminClient();
  const { data: logs } = await admin
    .from('audit_logs')
    .select('id, actor_id, action, entity, entity_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  const orgFilteredLogs = (logs as AuditLogRow[] | null | undefined)?.filter((log) => {
    if (!orgContext) return false;
    const orgIdInMeta = (log.metadata?.orgId as string | undefined) ?? undefined;
    return orgIdInMeta === orgContext.orgId;
  }) ?? [];

  const cutoffMs =
    range === '24h'
      ? 24 * 60 * 60 * 1000
      : range === '30d'
        ? 30 * 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const rangeFilteredLogs = orgFilteredLogs.filter((log) => new Date(log.created_at).getTime() >= now - cutoffMs);

  const availableEntities = Array.from(new Set(orgFilteredLogs.map((log) => log.entity))).sort((a, b) => a.localeCompare(b));

  const filteredLogs =
    entityFilter === 'all'
      ? rangeFilteredLogs
      : rangeFilteredLogs.filter((log) => log.entity === entityFilter);

  const actorIds = Array.from(new Set(filteredLogs.map((log) => log.actor_id).filter((id): id is string => Boolean(id))));
  const { data: actors } =
    actorIds.length > 0 ? await admin.from('profiles').select('id, email').in('id', actorIds) : { data: [] as Array<{ id: string; email: string | null }> };
  const actorEmailById = new Map((actors ?? []).map((actor) => [actor.id, actor.email ?? actor.id]));

  const events24h = orgFilteredLogs.filter((log) => new Date(log.created_at).getTime() >= now - 24 * 60 * 60 * 1000).length;
  const privilegedActions = filteredLogs.filter((log) =>
    ['organization_member', 'study_member', 'federated_node', 'study', 'cohort'].some((prefix) => log.entity.startsWith(prefix))
  ).length;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Audit Trail</h1>
        <p className={styles.subtitle}>
          Review critical workspace activity for traceability, governance, and regulatory evidence packaging.
        </p>
        <form method="get" className={styles.formGrid} style={{ marginTop: '0.85rem' }}>
          <div className={styles.field}>
            <label htmlFor="audit-range">Range</label>
            <select id="audit-range" name="range" className={styles.select} defaultValue={range}>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="audit-entity">Entity</label>
            <select id="audit-entity" name="entity" className={styles.select} defaultValue={entityFilter}>
              <option value="all">All entities</option>
              {availableEntities.map((entity) => (
                <option key={entity} value={entity}>
                  {entity}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.actions}>
            <button type="submit" className={styles.input} style={{ cursor: 'pointer', fontWeight: 700, minWidth: '150px' }}>
              Apply Filters
            </button>
          </div>
        </form>
      </header>

      <div className={styles.grid3}>
        <Card title="Events (24h)">
          <div className={styles.metric}>{events24h}</div>
          <p className={styles.metricLabel}>Audit events in the current organization over last 24 hours</p>
        </Card>
        <Card title="Privileged Actions">
          <div className={styles.metric}>{privilegedActions}</div>
          <p className={styles.metricLabel}>High-impact actions in current filtered scope</p>
        </Card>
        <Card title="Retention Policy">
          <div className={styles.metric}>7 years</div>
          <p className={styles.metricLabel}>Aligned for regulatory audit windows</p>
        </Card>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Event</th>
              <th>Actor</th>
              <th>Resource</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log) => (
              <tr key={log.id}>
                <td>{formatAction(log.action)}</td>
                <td>{log.actor_id ? actorEmailById.get(log.actor_id) ?? log.actor_id : 'system'}</td>
                <td>{log.entity_id ? `${log.entity} (${log.entity_id})` : log.entity}</td>
                <td>{formatTime(log.created_at)}</td>
              </tr>
            ))}
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={4}>No audit logs found for the selected organization yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
