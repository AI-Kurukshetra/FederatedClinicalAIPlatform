import { FlashToast } from '@/components/common/FlashToast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { decodeMessage } from '@/lib/auth/messages';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getPrimaryOrgContext } from '@/server/services/org-context';
import { archiveStudyAction, createStudyAction, restoreStudyAction, updateStudyStatusAction } from './actions';
import styles from '../workspace.module.css';

type StudyRow = {
  id: string;
  name: string;
  status: string;
  owner_id: string;
  updated_at: string;
};

function formatUpdatedAt(value: string) {
  return new Date(value).toLocaleString();
}

type StudiesPageProps = {
  searchParams?: Promise<{
    notice?: string;
    error?: string;
    showArchived?: string;
  }>;
};

export default async function StudiesPage({ searchParams }: StudiesPageProps) {
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
      .select('id, name, status, owner_id, updated_at, deleted_at')
      .eq('org_id', orgContext.orgId)
      .order('created_at', { ascending: false })
    : { data: [] as Array<StudyRow & { deleted_at: string | null }> };

  const { data: cohorts } = orgContext
    ? await supabase
        .from('cohorts')
        .select('id, study_id')
        .eq('org_id', orgContext.orgId)
        .is('deleted_at', null)
    : { data: [] as Array<{ id: string; study_id: string | null }> };

  const cohortCountByStudyId = new Map<string, number>();
  for (const item of cohorts ?? []) {
    if (!item.study_id) continue;
    cohortCountByStudyId.set(item.study_id, (cohortCountByStudyId.get(item.study_id) ?? 0) + 1);
  }

  const activeStudies = (studies ?? []).filter((study) => !study.deleted_at);
  const archivedStudies = (studies ?? []).filter((study) => Boolean(study.deleted_at));

  const studyRows = activeStudies.map((study) => ({
    id: study.id,
    name: study.name,
    status: study.status,
    owner: study.owner_id,
    cohorts: cohortCountByStudyId.get(study.id) ?? 0,
    updated: formatUpdatedAt(study.updated_at),
  }));

  const totalStudies = activeStudies.length;
  const activePrograms = studyRows.filter((row) => row.status === 'active').length;
  const pendingReview = studyRows.filter((row) => row.status === 'draft' || row.status === 'paused').length;

  return (
    <section className={styles.page}>
      {error ? <FlashToast tone="error" title="Study action failed" message={error} /> : null}
      {notice ? <FlashToast tone="success" title="Study update" message={notice} /> : null}
      <header className={styles.header}>
        <h1 className={styles.title}>Studies Workspace</h1>
        <p className={styles.subtitle}>
          Manage protocol-aligned studies, ownership, and operational readiness for downstream cohort discovery and RWE analytics.
        </p>
        <div className={styles.actions}>
          <Button>Create Study</Button>
          <Button variant="secondary">Import Metadata</Button>
          {showArchived ? (
            <a href="/studies" className={styles.inlineButton}>
              Hide Archived
            </a>
          ) : (
            <a href="/studies?showArchived=1" className={styles.inlineButton}>
              Show Archived ({archivedStudies.length})
            </a>
          )}
        </div>
      </header>

      <div className={styles.grid3}>
        <Card title="Total Studies">
          <div className={styles.metric}>{totalStudies}</div>
          <p className={styles.metricLabel}>In your current organization workspace</p>
        </Card>
        <Card title="Active Programs">
          <div className={styles.metric}>{activePrograms}</div>
          <p className={styles.metricLabel}>Studies currently in active status</p>
        </Card>
        <Card title="Pending Review">
          <div className={styles.metric}>{pendingReview}</div>
          <p className={styles.metricLabel}>Draft or paused studies requiring follow-up</p>
        </Card>
      </div>

      <Card title="Quick Create Study" description="Create a study directly in your active organization workspace.">
        <form action={createStudyAction} className={styles.formGridSingle}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="study-name">Study Name</label>
              <input id="study-name" name="name" className={styles.input} placeholder="NSCLC Real-World Response" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="study-status">Status</label>
              <select id="study-status" name="status" className={styles.select} defaultValue="draft">
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="completed">completed</option>
                <option value="archived">archived</option>
              </select>
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="study-description">Description</label>
            <textarea id="study-description" name="description" className={styles.textarea} placeholder="Study objective and scope." />
          </div>
          <div className={styles.actions}>
            <Button type="submit">Create Study</Button>
          </div>
        </form>
      </Card>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Study</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Cohorts</th>
              <th>Last Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {studyRows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>
                  <span className={`${styles.badge} ${row.status === 'active' ? styles.badgeGood : styles.badgeInfo}`}>
                    {row.status}
                  </span>
                </td>
                <td>{row.owner}</td>
                <td>{row.cohorts}</td>
                <td>{row.updated}</td>
                <td>
                  <div className={styles.inlineActions}>
                    <form action={updateStudyStatusAction} className={styles.inlineActions}>
                      <input type="hidden" name="id" value={row.id} />
                      <select name="status" defaultValue={row.status} className={styles.inlineSelect}>
                        <option value="draft">draft</option>
                        <option value="active">active</option>
                        <option value="paused">paused</option>
                        <option value="completed">completed</option>
                        <option value="archived">archived</option>
                      </select>
                      <button type="submit" className={styles.inlineButton}>
                        Save
                      </button>
                    </form>
                    <form action={archiveStudyAction}>
                      <input type="hidden" name="id" value={row.id} />
                      <button type="submit" className={`${styles.inlineButton} ${styles.inlineDanger}`}>
                        Archive
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {studyRows.length === 0 ? (
              <tr>
                <td colSpan={6}>No studies found. Create your first study to get started.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showArchived ? (
        <Card title="Archived Studies" description="Restore archived studies back to active workspace scope.">
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Study</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {archivedStudies.map((study) => (
                  <tr key={study.id}>
                    <td>{study.name}</td>
                    <td>{study.status}</td>
                    <td>{study.owner_id}</td>
                    <td>
                      <form action={restoreStudyAction}>
                        <input type="hidden" name="id" value={study.id} />
                        <button type="submit" className={styles.inlineButton}>
                          Restore
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {archivedStudies.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No archived studies.</td>
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
