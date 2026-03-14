import { FlashToast } from '@/components/common/FlashToast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { decodeMessage } from '@/lib/auth/messages';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getPrimaryOrgContext } from '@/server/services/org-context';
import { createRweReportAction, updateRweReportStatusAction } from './actions';
import styles from '../workspace.module.css';

type ReportsPageProps = {
  searchParams?: Promise<{ notice?: string; error?: string }>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = (await searchParams) ?? {};
  const notice = decodeMessage(params.notice);
  const error = decodeMessage(params.error);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const orgContext = user ? await getPrimaryOrgContext(supabase, user.id) : null;

  const { data: studies } = orgContext
    ? await supabase.from('studies').select('id, name').eq('org_id', orgContext.orgId).is('deleted_at', null).order('created_at', { ascending: false })
    : { data: [] as Array<{ id: string; name: string }> };

  const { data: reports } = orgContext
    ? await supabase
        .from('rwe_reports')
        .select('id, report_name, report_type, status, generated_at, file_url, study_id, created_at')
        .eq('org_id', orgContext.orgId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(200)
    : {
        data: [] as Array<{
          id: string;
          report_name: string;
          report_type: string;
          status: string;
          generated_at: string | null;
          file_url: string | null;
          study_id: string | null;
          created_at: string;
        }>,
      };

  const studyNameById = new Map((studies ?? []).map((study) => [study.id, study.name]));
  const readyCount = (reports ?? []).filter((item) => item.status === 'ready').length;

  return (
    <section className={styles.page}>
      {error ? <FlashToast tone="error" title="Report action failed" message={error} /> : null}
      {notice ? <FlashToast tone="success" title="Report update" message={notice} /> : null}

      <header className={styles.header}>
        <h1 className={styles.title}>RWE Reports</h1>
        <p className={styles.subtitle}>Generate and track real-world evidence report artifacts for outcomes, safety, and regulatory workflows.</p>
      </header>

      <div className={styles.grid3}>
        <Card title="Total Reports">
          <div className={styles.metric}>{reports?.length ?? 0}</div>
          <p className={styles.metricLabel}>Report runs in this workspace</p>
        </Card>
        <Card title="Ready Exports">
          <div className={styles.metric}>{readyCount}</div>
          <p className={styles.metricLabel}>Reports available for downstream handoff</p>
        </Card>
        <Card title="In Progress">
          <div className={styles.metric}>{(reports ?? []).filter((item) => item.status === 'running').length}</div>
          <p className={styles.metricLabel}>Currently generating report jobs</p>
        </Card>
      </div>

      <Card title="Generate Report" description="Create a new RWE report generation task.">
        <form action={createRweReportAction} className={styles.formGridSingle}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="report-name">Report Name</label>
              <input id="report-name" name="reportName" className={styles.input} placeholder="Q1 NSCLC Outcome Analysis" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="report-type">Report Type</label>
              <select id="report-type" name="reportType" className={styles.select} defaultValue="outcomes">
                <option value="outcomes">outcomes</option>
                <option value="safety">safety</option>
                <option value="efficacy">efficacy</option>
                <option value="regulatory_package">regulatory_package</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="report-study">Study (optional)</label>
              <select id="report-study" name="studyId" className={styles.select} defaultValue="">
                <option value="">Unlinked</option>
                {(studies ?? []).map((study) => (
                  <option key={study.id} value={study.id}>
                    {study.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.actions}>
            <Button type="submit">Generate</Button>
          </div>
        </form>
      </Card>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Report</th>
              <th>Type</th>
              <th>Status</th>
              <th>Study</th>
              <th>Generated</th>
              <th>File</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(reports ?? []).map((report) => (
              <tr key={report.id}>
                <td>{report.report_name}</td>
                <td>{report.report_type}</td>
                <td>{report.status}</td>
                <td>{report.study_id ? studyNameById.get(report.study_id) ?? report.study_id : 'Unlinked'}</td>
                <td>{report.generated_at ? new Date(report.generated_at).toLocaleString() : 'N/A'}</td>
                <td>{report.file_url ? <a href={report.file_url}>Download</a> : '-'}</td>
                <td>
                  <form action={updateRweReportStatusAction} className={styles.inlineActions}>
                    <input type="hidden" name="id" value={report.id} />
                    <select name="status" defaultValue={report.status} className={styles.inlineSelect}>
                      <option value="draft">draft</option>
                      <option value="running">running</option>
                      <option value="ready">ready</option>
                      <option value="failed">failed</option>
                      <option value="archived">archived</option>
                    </select>
                    <button type="submit" className={styles.inlineButton}>
                      Save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(reports ?? []).length === 0 ? (
              <tr>
                <td colSpan={7}>No reports found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
