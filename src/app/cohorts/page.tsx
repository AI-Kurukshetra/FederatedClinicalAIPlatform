import { FlashToast } from '@/components/common/FlashToast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { decodeMessage } from '@/lib/auth/messages';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getPrimaryOrgContext } from '@/server/services/org-context';
import { archiveCohortAction, createCohortAction, restoreCohortAction } from './actions';
import styles from '../workspace.module.css';

type CohortsPageProps = {
  searchParams?: Promise<{
    notice?: string;
    error?: string;
    showArchived?: string;
  }>;
};

function formatDate(value: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

export default async function CohortsPage({ searchParams }: CohortsPageProps) {
  const params = (await searchParams) ?? {};
  const notice = decodeMessage(params.notice);
  const error = decodeMessage(params.error);
  const showArchived = params.showArchived === '1';

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const orgContext = user ? await getPrimaryOrgContext(supabase, user.id) : null;

  const { data: studies } = orgContext
    ? await supabase
        .from('studies')
        .select('id, name')
        .eq('org_id', orgContext.orgId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
    : { data: [] as Array<{ id: string; name: string }> };

  const { data: cohorts } = orgContext
    ? await supabase
      .from('cohorts')
      .select('id, study_id, name, created_at, deleted_at')
      .eq('org_id', orgContext.orgId)
      .order('created_at', { ascending: false })
    : { data: [] as Array<{ id: string; study_id: string | null; name: string; created_at: string; deleted_at: string | null }> };

  const { data: versions } = orgContext
    ? await supabase.from('cohort_versions').select('cohort_id, id').order('created_at', { ascending: false })
    : { data: [] as Array<{ cohort_id: string; id: string }> };

  const { data: runs } = orgContext
    ? await supabase
        .from('cohort_runs')
        .select('cohort_version_id, status, created_at')
        .order('created_at', { ascending: false })
        .limit(200)
    : { data: [] as Array<{ cohort_version_id: string; status: string; created_at: string }> };

  const studyNameById = new Map((studies ?? []).map((s) => [s.id, s.name]));
  const versionCountByCohortId = new Map<string, number>();
  for (const version of versions ?? []) {
    versionCountByCohortId.set(version.cohort_id, (versionCountByCohortId.get(version.cohort_id) ?? 0) + 1);
  }

  const cohortIdByVersionId = new Map<string, string>();
  for (const version of versions ?? []) cohortIdByVersionId.set(version.id, version.cohort_id);

  const latestRunByCohortId = new Map<string, { status: string; created_at: string }>();
  for (const run of runs ?? []) {
    const cohortId = cohortIdByVersionId.get(run.cohort_version_id);
    if (!cohortId || latestRunByCohortId.has(cohortId)) continue;
    latestRunByCohortId.set(cohortId, { status: run.status, created_at: run.created_at });
  }

  const activeCohorts = (cohorts ?? []).filter((cohort) => !cohort.deleted_at);
  const archivedCohorts = (cohorts ?? []).filter((cohort) => Boolean(cohort.deleted_at));

  const rows = activeCohorts.map((cohort) => {
    const latestRun = latestRunByCohortId.get(cohort.id);
    return {
      id: cohort.id,
      name: cohort.name,
      study: cohort.study_id ? studyNameById.get(cohort.study_id) ?? cohort.study_id : 'Unassigned',
      versions: versionCountByCohortId.get(cohort.id) ?? 0,
      lastRun: formatDate(latestRun?.created_at ?? null),
      status: latestRun?.status ?? 'ready',
    };
  });

  const publishedCount = activeCohorts.length;
  const runsToday = Array.from(latestRunByCohortId.values()).filter((item) => {
    const runDate = new Date(item.created_at);
    const now = new Date();
    return runDate.toDateString() === now.toDateString();
  }).length;
  const failedRuns = Array.from(latestRunByCohortId.values()).filter((item) => item.status === 'failed').length;
  const failureRate = rows.length > 0 ? `${((failedRuns / rows.length) * 100).toFixed(1)}%` : '0.0%';

  return (
    <section className={styles.page}>
      {error ? <FlashToast tone="error" title="Cohort action failed" message={error} /> : null}
      {notice ? <FlashToast tone="success" title="Cohort update" message={notice} /> : null}
      <header className={styles.header}>
        <h1 className={styles.title}>Cohort Discovery</h1>
        <p className={styles.subtitle}>
          Define, version, and execute cohort logic consistently across federated partner institutions without centralizing raw PHI.
        </p>
        <div className={styles.actions}>
          <Button>Create Cohort</Button>
          <a href="/cohorts?notice=Select+a+cohort+and+open+Builder+from+Actions" className={styles.inlineButton}>
            Open Builder
          </a>
          {showArchived ? (
            <a href="/cohorts" className={styles.inlineButton}>
              Hide Archived
            </a>
          ) : (
            <a href="/cohorts?showArchived=1" className={styles.inlineButton}>
              Show Archived ({archivedCohorts.length})
            </a>
          )}
        </div>
      </header>

      <div className={styles.grid3}>
        <Card title="Published Cohorts">
          <div className={styles.metric}>{publishedCount}</div>
          <p className={styles.metricLabel}>Cohorts in this organization</p>
        </Card>
        <Card title="Runs Today">
          <div className={styles.metric}>{runsToday}</div>
          <p className={styles.metricLabel}>Recent cohort executions today</p>
        </Card>
        <Card title="Failure Rate">
          <div className={styles.metric}>{failureRate}</div>
          <p className={styles.metricLabel}>Latest-run failure ratio by cohort</p>
        </Card>
      </div>

      <Card title="Quick Create Cohort" description="Create a cohort and map it to an existing study when needed.">
        <form action={createCohortAction} className={styles.formGridSingle}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="cohort-name">Cohort Name</label>
              <input id="cohort-name" name="name" className={styles.input} placeholder="Stage IV NSCLC, PD-L1 High" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="cohort-study">Study (optional)</label>
              <select id="cohort-study" name="studyId" className={styles.select} defaultValue="">
                <option value="">Unassigned</option>
                {(studies ?? []).map((study) => (
                  <option key={study.id} value={study.id}>
                    {study.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="cohort-description">Description</label>
            <textarea id="cohort-description" name="description" className={styles.textarea} placeholder="Brief cohort intent." />
          </div>
          <div className={styles.actions}>
            <Button type="submit">Create Cohort</Button>
          </div>
        </form>
      </Card>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Cohort</th>
              <th>Study</th>
              <th>Versions</th>
              <th>Last Run</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.study}</td>
                <td>{row.versions}</td>
                <td>{row.lastRun}</td>
                <td>
                  <span className={`${styles.badge} ${row.status === 'failed' ? styles.badgeWarn : styles.badgeGood}`}>
                    {row.status}
                  </span>
                </td>
                <td>
                  <div className={styles.inlineActions}>
                    <a href={`/cohorts/${row.id}`} className={styles.inlineButton}>
                      View
                    </a>
                    <a href={`/cohorts/${row.id}/builder`} className={styles.inlineButton}>
                      Builder
                    </a>
                    <form action={archiveCohortAction}>
                      <input type="hidden" name="id" value={row.id} />
                      <button type="submit" className={`${styles.inlineButton} ${styles.inlineDanger}`}>
                        Archive
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6}>No cohorts found. Create your first cohort to get started.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showArchived ? (
        <Card title="Archived Cohorts" description="Restore archived cohorts when needed.">
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Cohort</th>
                  <th>Study</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {archivedCohorts.map((cohort) => (
                  <tr key={cohort.id}>
                    <td>{cohort.name}</td>
                    <td>{cohort.study_id ? studyNameById.get(cohort.study_id) ?? cohort.study_id : 'Unassigned'}</td>
                    <td>
                      <form action={restoreCohortAction}>
                        <input type="hidden" name="id" value={cohort.id} />
                        <button type="submit" className={styles.inlineButton}>
                          Restore
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {archivedCohorts.length === 0 ? (
                  <tr>
                    <td colSpan={3}>No archived cohorts.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </section>
  );
}
