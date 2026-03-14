import Link from 'next/link';
import { FlashToast } from '@/components/common/FlashToast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { decodeMessage } from '@/lib/auth/messages';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { triggerCohortRunFromDetailAction, updateCohortRunStatusAction } from './actions';
import styles from '../../workspace.module.css';

type CohortDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ notice?: string; error?: string }>;
};

function formatDateTime(value: string | null) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString();
}

export default async function CohortDetailPage({ params, searchParams }: CohortDetailPageProps) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const notice = decodeMessage(query.notice);
  const error = decodeMessage(query.error);

  const supabase = await createServerSupabaseClient();
  const cohortResult = await supabase
    .from('cohorts')
    .select('id, name, description, study_id, created_at, deleted_at')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!cohortResult.data) {
    return (
      <section className={styles.page}>
        <FlashToast tone="error" title="Cohort not found" message="The requested cohort does not exist or is archived." />
        <Link href="/cohorts" className={styles.inlineButton}>
          Back to cohorts
        </Link>
      </section>
    );
  }

  const versionsResult = await supabase
    .from('cohort_versions')
    .select('id, version_no, definition_json, created_at, created_by')
    .eq('cohort_id', id)
    .order('version_no', { ascending: false });

  const versionIds = (versionsResult.data ?? []).map((version) => version.id);

  const runsResult =
    versionIds.length > 0
      ? await supabase
          .from('cohort_runs')
          .select('id, cohort_version_id, status, result_count, created_at, started_at, finished_at, created_by')
          .in('cohort_version_id', versionIds)
          .order('created_at', { ascending: false })
          .limit(100)
      : { data: [] as Array<{ id: string; cohort_version_id: string; status: string; result_count: number | null; created_at: string; started_at: string | null; finished_at: string | null; created_by: string }> };

  const versions = versionsResult.data ?? [];
  const runs = runsResult.data ?? [];
  const versionNoById = new Map(versions.map((version) => [version.id, version.version_no]));

  return (
    <section className={styles.page}>
      {error ? <FlashToast tone="error" title="Cohort action failed" message={error} /> : null}
      {notice ? <FlashToast tone="success" title="Cohort update" message={notice} /> : null}

      <header className={styles.header}>
        <h1 className={styles.title}>{cohortResult.data.name}</h1>
        <p className={styles.subtitle}>{cohortResult.data.description || 'No description added yet.'}</p>
        <div className={styles.actions}>
          <Link href="/cohorts" className={styles.inlineButton}>
            Back to cohorts
          </Link>
          <Link href={`/cohorts/${id}/builder`} className={styles.inlineButton}>
            Open Builder
          </Link>
        </div>
      </header>

      <div className={styles.grid3}>
        <Card title="Published Versions">
          <div className={styles.metric}>{versions.length}</div>
          <p className={styles.metricLabel}>Total cohort logic versions</p>
        </Card>
        <Card title="Run Executions">
          <div className={styles.metric}>{runs.length}</div>
          <p className={styles.metricLabel}>Queued/running/completed history</p>
        </Card>
        <Card title="Last Updated">
          <div className={styles.metric}>{formatDateTime(versions[0]?.created_at ?? cohortResult.data.created_at)}</div>
          <p className={styles.metricLabel}>Most recent cohort version timestamp</p>
        </Card>
      </div>

      <Card title="Trigger Cohort Run" description="Run latest version or target a specific version.">
        <form action={triggerCohortRunFromDetailAction} className={styles.formGridSingle}>
          <input type="hidden" name="cohortId" value={id} />
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="cohort-version-id">Version</label>
              <select id="cohort-version-id" name="cohortVersionId" className={styles.select} defaultValue="">
                <option value="">Latest published version</option>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    v{version.version_no} ({formatDateTime(version.created_at)})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.actions}>
            <Button type="submit">Queue Run</Button>
          </div>
        </form>
      </Card>

      <Card title="Version History">
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Version</th>
                <th>Created</th>
                <th>Author</th>
                <th>Definition Preview</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id}>
                  <td>v{version.version_no}</td>
                  <td>{formatDateTime(version.created_at)}</td>
                  <td>{version.created_by}</td>
                  <td>
                    <code>{JSON.stringify(version.definition_json).slice(0, 120)}{JSON.stringify(version.definition_json).length > 120 ? '...' : ''}</code>
                  </td>
                </tr>
              ))}
              {versions.length === 0 ? (
                <tr>
                  <td colSpan={4}>No cohort versions yet. Publish the first version from the builder.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Run History">
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Version</th>
                <th>Status</th>
                <th>Created</th>
                <th>Started</th>
                <th>Finished</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{run.id}</td>
                  <td>v{versionNoById.get(run.cohort_version_id) ?? '-'}</td>
                  <td>{run.status}</td>
                  <td>{formatDateTime(run.created_at)}</td>
                  <td>{formatDateTime(run.started_at)}</td>
                  <td>{formatDateTime(run.finished_at)}</td>
                  <td>
                    <form action={updateCohortRunStatusAction} className={styles.inlineActions}>
                      <input type="hidden" name="cohortId" value={id} />
                      <input type="hidden" name="runId" value={run.id} />
                      <select name="status" defaultValue={run.status} className={styles.inlineSelect}>
                        <option value="queued">queued</option>
                        <option value="running">running</option>
                        <option value="completed">completed</option>
                        <option value="failed">failed</option>
                      </select>
                      <button type="submit" className={styles.inlineButton}>
                        Update
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={7}>No runs yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
