import { FlashToast } from '@/components/common/FlashToast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { decodeMessage } from '@/lib/auth/messages';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getPrimaryOrgContext } from '@/server/services/org-context';
import { runAnalysisAction } from './actions';
import styles from '../workspace.module.css';

type IngestionRun = {
  id: string;
  source_name: string;
  source_type: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  records_processed: number | null;
  created_at: string;
};

type QualityMetric = {
  metric_value: number;
  measured_at: string;
};

function formatDuration(startedAt: string | null, finishedAt: string | null) {
  if (!startedAt || !finishedAt) return 'In progress';
  const diffMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return 'Unknown';
  const totalSec = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}m ${seconds}s`;
}

function getDayKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildSparklinePoints(values: number[]) {
  if (values.length === 0) return '';
  const width = 100;
  const height = 36;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');
}

type AnalyticsPageProps = {
  searchParams?: Promise<{
    days?: string;
    sourceType?: string;
    notice?: string;
    error?: string;
  }>;
};

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = (await searchParams) ?? {};
  const daysRaw = Number(params.days ?? '30');
  const days = [7, 30, 90].includes(daysRaw) ? daysRaw : 30;
  const sourceType = params.sourceType ?? 'all';
  const notice = decodeMessage(params.notice);
  const error = decodeMessage(params.error);
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const orgContext = user ? await getPrimaryOrgContext(supabase, user.id) : null;

  const { data: runs } = orgContext
    ? await supabase
        .from('ingestion_jobs')
        .select('id, source_name, source_type, status, started_at, finished_at, records_processed, created_at')
        .eq('org_id', orgContext.orgId)
        .is('deleted_at', null)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(200)
    : { data: [] as IngestionRun[] };

  const filteredRuns = (runs ?? []).filter((run) => sourceType === 'all' || run.source_type === sourceType);
  const sourceNamesInFilter = new Set(filteredRuns.map((run) => run.source_name));

  const { data: rawMetrics } = orgContext
    ? await supabase
        .from('data_quality_metrics')
        .select('metric_value, measured_at, source_name')
        .eq('org_id', orgContext.orgId)
        .is('deleted_at', null)
        .gte('measured_at', sinceIso)
        .order('measured_at', { ascending: false })
        .limit(200)
    : { data: [] as Array<QualityMetric & { source_name: string }> };

  const metrics =
    sourceType === 'all' ? rawMetrics ?? [] : (rawMetrics ?? []).filter((metric) => sourceNamesInFilter.has(metric.source_name));

  const runRows = filteredRuns.map((run) => ({
    id: run.id,
    query: `${run.source_name} ingestion`,
    status: run.status,
    duration: formatDuration(run.started_at, run.finished_at),
    result: run.records_processed != null ? `${run.records_processed} records` : 'Pending',
  }));

  const completed = runRows.filter((row) => row.status === 'completed').length;
  const running = runRows.filter((row) => row.status === 'running').length;
  const failed = runRows.filter((row) => row.status === 'failed').length;
  const avgProcessed = (() => {
    const values = filteredRuns.map((item) => item.records_processed).filter((value): value is number => value != null);
    if (values.length === 0) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  })();

  const qualityByDay = new Map<string, number[]>();
  for (const metric of metrics ?? []) {
    const key = getDayKey(metric.measured_at);
    const values = qualityByDay.get(key) ?? [];
    values.push(Number(metric.metric_value));
    qualityByDay.set(key, values);
  }
  const dailyAverages = Array.from(qualityByDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-7)
    .map(([, values]) => values.reduce((sum, value) => sum + value, 0) / values.length);
  const sparklinePoints = buildSparklinePoints(dailyAverages);
  const latestQuality = dailyAverages.length > 0 ? dailyAverages[dailyAverages.length - 1] : 0;

  const statusCounts = new Map<string, number>();
  for (const run of runRows) statusCounts.set(run.status, (statusCounts.get(run.status) ?? 0) + 1);
  const statusKeys = ['queued', 'running', 'completed', 'failed'];
  const maxStatusCount = Math.max(1, ...statusKeys.map((key) => statusCounts.get(key) ?? 0));

  return (
    <section className={styles.page}>
      {error ? <FlashToast tone="error" title="Analytics action failed" message={error} /> : null}
      {notice ? <FlashToast tone="success" title="Analytics update" message={notice} /> : null}
      <header className={styles.header}>
        <h1 className={styles.title}>RWE Analytics</h1>
        <p className={styles.subtitle}>
          Launch privacy-preserving analyses, monitor run health, and prepare evidence outputs for internal decisioning and submissions.
        </p>
        <div className={styles.actions}>
          <form action={runAnalysisAction}>
            <Button type="submit">Run Analysis</Button>
          </form>
          <Button variant="secondary">Open Reports</Button>
        </div>
        <form method="get" className={styles.formGrid} style={{ marginTop: '0.85rem' }}>
          <div className={styles.field}>
            <label htmlFor="analytics-days">Time Window</label>
            <select id="analytics-days" name="days" className={styles.select} defaultValue={String(days)}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="analytics-source-type">Source Type</label>
            <select id="analytics-source-type" name="sourceType" className={styles.select} defaultValue={sourceType}>
              <option value="all">All</option>
              <option value="ehr">ehr</option>
              <option value="pacs">pacs</option>
              <option value="lab">lab</option>
              <option value="notes">notes</option>
              <option value="claims">claims</option>
              <option value="fhir">fhir</option>
              <option value="other">other</option>
            </select>
          </div>
          <div className={styles.actions}>
            <Button type="submit">Apply Filters</Button>
          </div>
        </form>
      </header>

      <div className={styles.grid3}>
        <Card title="Analyses Today">
          <div className={styles.metric}>{runRows.length}</div>
          <p className={styles.metricLabel}>Recent ingestion and analytics pipeline runs</p>
        </Card>
        <Card title="Completed Runs">
          <div className={styles.metric}>{completed}</div>
          <p className={styles.metricLabel}>Finished with output records ready</p>
        </Card>
        <Card title="Running Jobs">
          <div className={styles.metric}>{running}</div>
          <p className={styles.metricLabel}>Currently processing across connected nodes</p>
        </Card>
      </div>

      <div className={styles.grid3}>
        <Card title="Failure Count">
          <div className={styles.metric}>{failed}</div>
          <p className={styles.metricLabel}>Runs currently in failed state</p>
        </Card>
        <Card title="Avg Records Processed">
          <div className={styles.metric}>{avgProcessed.toLocaleString()}</div>
          <p className={styles.metricLabel}>Average rows processed across recent runs</p>
        </Card>
        <Card title="Latest Quality Score">
          <div className={styles.metric}>{latestQuality.toFixed(1)}%</div>
          <p className={styles.metricLabel}>Most recent daily average from quality metrics</p>
        </Card>
      </div>

      <div className={styles.chartGrid}>
        <Card title="Quality Score Trend (7 Days)" description="Daily average quality metric from recent measurements.">
          <div className={styles.sparklineWrap}>
            <svg viewBox="0 0 100 36" preserveAspectRatio="none" className={styles.sparklineSvg}>
              <polyline points={sparklinePoints || '0,36'} fill="none" stroke="#0c63ca" strokeWidth="2" />
            </svg>
          </div>
          <p className={styles.sparklineLabel}>{dailyAverages.length > 0 ? 'Trend refreshed from live metrics.' : 'No quality metrics available yet.'}</p>
        </Card>

        <Card title="Job Status Distribution" description="Current distribution across ingestion and analytics runs.">
          <div className={styles.bars}>
            {statusKeys.map((key) => {
              const count = statusCounts.get(key) ?? 0;
              const percent = (count / maxStatusCount) * 100;
              return (
                <div key={key} className={styles.barRow}>
                  <span className={styles.barLabel}>{key}</span>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${percent}%` }} />
                  </div>
                  <span className={styles.barValue}>{count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Analysis</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Output</th>
            </tr>
          </thead>
          <tbody>
            {runRows.map((row) => (
              <tr key={row.id}>
                <td>{row.query}</td>
                <td>
                  <span className={`${styles.badge} ${row.status === 'running' ? styles.badgeWarn : styles.badgeGood}`}>
                    {row.status}
                  </span>
                </td>
                <td>{row.duration}</td>
                <td>{row.result}</td>
              </tr>
            ))}
            {runRows.length === 0 ? (
              <tr>
                <td colSpan={4}>No analytics runs found yet for this organization.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
