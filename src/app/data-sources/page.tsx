import { FlashToast } from '@/components/common/FlashToast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { decodeMessage } from '@/lib/auth/messages';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getPrimaryOrgContext } from '@/server/services/org-context';
import {
  archiveDataQualityMetricAction,
  archiveIngestionJobAction,
  createConnectorConfigAction,
  createDataQualityMetricAction,
  createIngestionJobAction,
  createQualityRuleAction,
  restoreDataQualityMetricAction,
  restoreIngestionJobAction,
  runQualityScanAction,
  toggleQualityRuleAction,
  updateConnectorStatusAction,
} from './actions';
import styles from '../workspace.module.css';

type MetricRow = {
  id: string;
  source_name: string;
  metric_name: string;
  metric_value: number;
  status: string;
  measured_at: string;
  deleted_at: string | null;
};

type JobRow = {
  id: string;
  source_name: string;
  source_type: string;
  status: string;
  finished_at: string | null;
  created_at: string;
  deleted_at: string | null;
};

type ConnectorRow = {
  id: string;
  name: string;
  source_type: string;
  status: string;
  schedule_cron: string | null;
  node_id: string | null;
  last_sync_at: string | null;
  deleted_at: string | null;
};

type QualityRuleRow = {
  id: string;
  rule_name: string;
  metric_name: string;
  threshold: number;
  comparator: string;
  severity: string;
  is_active: boolean;
  connector_id: string | null;
  deleted_at: string | null;
};

function formatTimestamp(value: string | null) {
  if (!value) return 'Pending';
  return new Date(value).toLocaleString();
}

type DataSourcesPageProps = {
  searchParams?: Promise<{
    notice?: string;
    error?: string;
    showArchived?: string;
  }>;
};

export default async function DataSourcesPage({ searchParams }: DataSourcesPageProps) {
  const params = (await searchParams) ?? {};
  const notice = decodeMessage(params.notice);
  const error = decodeMessage(params.error);
  const showArchived = params.showArchived === '1';

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const orgContext = user ? await getPrimaryOrgContext(supabase, user.id) : null;

  const { data: metrics } = orgContext
    ? await supabase
        .from('data_quality_metrics')
        .select('id, source_name, metric_name, metric_value, status, measured_at, deleted_at')
        .eq('org_id', orgContext.orgId)
        .order('measured_at', { ascending: false })
        .limit(120)
    : { data: [] as MetricRow[] };

  const { data: jobs } = orgContext
    ? await supabase
        .from('ingestion_jobs')
        .select('id, source_name, source_type, status, finished_at, created_at, deleted_at')
        .eq('org_id', orgContext.orgId)
        .order('created_at', { ascending: false })
        .limit(120)
    : { data: [] as JobRow[] };

  const { data: connectors } = orgContext
    ? await supabase
        .from('connector_configs')
        .select('id, name, source_type, status, schedule_cron, node_id, last_sync_at, deleted_at')
        .eq('org_id', orgContext.orgId)
        .order('created_at', { ascending: false })
        .limit(120)
    : { data: [] as ConnectorRow[] };

  const { data: qualityRules } = orgContext
    ? await supabase
        .from('quality_rules')
        .select('id, rule_name, metric_name, threshold, comparator, severity, is_active, connector_id, deleted_at')
        .eq('org_id', orgContext.orgId)
        .order('created_at', { ascending: false })
        .limit(120)
    : { data: [] as QualityRuleRow[] };

  const activeMetrics = (metrics ?? []).filter((item) => !item.deleted_at);
  const archivedMetrics = (metrics ?? []).filter((item) => Boolean(item.deleted_at));
  const activeJobs = (jobs ?? []).filter((item) => !item.deleted_at);
  const archivedJobs = (jobs ?? []).filter((item) => Boolean(item.deleted_at));
  const activeConnectors = (connectors ?? []).filter((item) => !item.deleted_at);
  const activeQualityRules = (qualityRules ?? []).filter((item) => !item.deleted_at);

  const latestMetricBySource = new Map<string, MetricRow>();
  for (const metric of activeMetrics) {
    if (!latestMetricBySource.has(metric.source_name)) latestMetricBySource.set(metric.source_name, metric);
  }

  const latestJobBySource = new Map<string, JobRow>();
  for (const job of activeJobs) {
    if (!latestJobBySource.has(job.source_name)) latestJobBySource.set(job.source_name, job);
  }

  const sourceNames = Array.from(new Set([...activeMetrics.map((m) => m.source_name), ...activeJobs.map((j) => j.source_name)]));
  const sourceRows = sourceNames.map((name) => {
    const metric = latestMetricBySource.get(name);
    const job = latestJobBySource.get(name);
    return {
      name,
      type: job?.source_type ?? 'other',
      quality: metric ? `${metric.metric_value.toFixed(1)}%` : 'N/A',
      lastSync: formatTimestamp(job?.finished_at ?? job?.created_at ?? null),
      status: metric?.status ?? (job?.status === 'failed' ? 'warning' : 'good'),
    };
  });

  const averageQuality =
    activeMetrics.length > 0 ? activeMetrics.reduce((sum, item) => sum + Number(item.metric_value), 0) / activeMetrics.length : 0;
  const failedJobs = activeJobs.filter((item) => item.status === 'failed').length;

  return (
    <section className={styles.page}>
      {error ? <FlashToast tone="error" title="Data source action failed" message={error} /> : null}
      {notice ? <FlashToast tone="success" title="Data source update" message={notice} /> : null}
      <header className={styles.header}>
        <h1 className={styles.title}>Clinical Data Sources</h1>
        <p className={styles.subtitle}>
          Track ingestion health, schema readiness, and quality metrics for federated clinical data pipelines.
        </p>
        <div className={styles.actions}>
          <Button>Add Source</Button>
          <form action={runQualityScanAction}>
            <Button variant="secondary" type="submit">
              Run Quality Scan
            </Button>
          </form>
          {showArchived ? (
            <a href="/data-sources" className={styles.inlineButton}>
              Hide Archived
            </a>
          ) : (
            <a href="/data-sources?showArchived=1" className={styles.inlineButton}>
              Show Archived ({archivedJobs.length + archivedMetrics.length})
            </a>
          )}
        </div>
      </header>

      <div className={styles.grid3}>
        <Card title="Connected Sources">
          <div className={styles.metric}>{sourceRows.length}</div>
          <p className={styles.metricLabel}>Unique source streams tracked in this org</p>
        </Card>
        <Card title="Data Quality Score">
          <div className={styles.metric}>{averageQuality.toFixed(1)}%</div>
          <p className={styles.metricLabel}>Average observed quality metric across recent records</p>
        </Card>
        <Card title="Failed Sync Jobs">
          <div className={styles.metric}>{failedJobs}</div>
          <p className={styles.metricLabel}>Ingestion jobs marked failed in recent history</p>
        </Card>
      </div>

      <div className={styles.grid2}>
        <Card title="Create Ingestion Job" description="Track new ingestion execution from any source pipeline.">
          <form action={createIngestionJobAction} className={styles.formGridSingle}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="ing-source-name">Source Name</label>
                <input id="ing-source-name" name="sourceName" className={styles.input} placeholder="Epic EHR Feed" required />
              </div>
              <div className={styles.field}>
                <label htmlFor="ing-source-type">Source Type</label>
                <select id="ing-source-type" name="sourceType" className={styles.select} defaultValue="ehr">
                  <option value="ehr">ehr</option>
                  <option value="pacs">pacs</option>
                  <option value="lab">lab</option>
                  <option value="notes">notes</option>
                  <option value="claims">claims</option>
                  <option value="fhir">fhir</option>
                  <option value="other">other</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="ing-status">Status</label>
                <select id="ing-status" name="status" className={styles.select} defaultValue="queued">
                  <option value="queued">queued</option>
                  <option value="running">running</option>
                  <option value="completed">completed</option>
                  <option value="failed">failed</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="ing-records">Records Processed (optional)</label>
                <input id="ing-records" name="recordsProcessed" className={styles.input} placeholder="25000" />
              </div>
            </div>
            <div className={styles.actions}>
              <Button type="submit">Create Job</Button>
            </div>
          </form>
        </Card>

        <Card title="Add Quality Metric" description="Insert a quality metric event for source monitoring and trend tracking.">
          <form action={createDataQualityMetricAction} className={styles.formGridSingle}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="dq-source-name">Source Name</label>
                <input id="dq-source-name" name="sourceName" className={styles.input} placeholder="Epic EHR Feed" required />
              </div>
              <div className={styles.field}>
                <label htmlFor="dq-metric-name">Metric Name</label>
                <input id="dq-metric-name" name="metricName" className={styles.input} placeholder="completeness_score" required />
              </div>
              <div className={styles.field}>
                <label htmlFor="dq-value">Metric Value (0-100)</label>
                <input id="dq-value" name="metricValue" className={styles.input} placeholder="96.4" required />
              </div>
              <div className={styles.field}>
                <label htmlFor="dq-status">Status</label>
                <select id="dq-status" name="status" className={styles.select} defaultValue="good">
                  <option value="good">good</option>
                  <option value="warning">warning</option>
                  <option value="critical">critical</option>
                </select>
              </div>
            </div>
            <div className={styles.actions}>
              <Button type="submit">Add Metric</Button>
            </div>
          </form>
        </Card>
      </div>

      <div className={styles.grid2}>
        <Card title="Connector Config" description="Define source connector metadata and pipeline schedule.">
          <form action={createConnectorConfigAction} className={styles.formGridSingle}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="cc-name">Connector Name</label>
                <input id="cc-name" name="name" className={styles.input} placeholder="Epic FHIR Feed - East" required />
              </div>
              <div className={styles.field}>
                <label htmlFor="cc-source-type">Source Type</label>
                <select id="cc-source-type" name="sourceType" className={styles.select} defaultValue="fhir">
                  <option value="ehr">ehr</option>
                  <option value="pacs">pacs</option>
                  <option value="lab">lab</option>
                  <option value="notes">notes</option>
                  <option value="claims">claims</option>
                  <option value="fhir">fhir</option>
                  <option value="omics">omics</option>
                  <option value="other">other</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="cc-status">Status</label>
                <select id="cc-status" name="status" className={styles.select} defaultValue="active">
                  <option value="active">active</option>
                  <option value="paused">paused</option>
                  <option value="failed">failed</option>
                  <option value="archived">archived</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="cc-schedule">Schedule Cron (optional)</label>
                <input id="cc-schedule" name="scheduleCron" className={styles.input} placeholder="0 */6 * * *" />
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor="cc-config-json">Config JSON (optional)</label>
              <textarea id="cc-config-json" name="configJson" className={styles.textarea} placeholder='{"fhirVersion":"R4","mode":"incremental"}' />
            </div>
            <div className={styles.actions}>
              <Button type="submit">Create Connector</Button>
            </div>
          </form>
        </Card>

        <Card title="Quality Rule Definition" description="Create threshold rules to evaluate ingestion metrics.">
          <form action={createQualityRuleAction} className={styles.formGridSingle}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="qr-name">Rule Name</label>
                <input id="qr-name" name="ruleName" className={styles.input} placeholder="Completeness must stay above 95%" required />
              </div>
              <div className={styles.field}>
                <label htmlFor="qr-metric">Metric Name</label>
                <input id="qr-metric" name="metricName" className={styles.input} placeholder="completeness_score" required />
              </div>
              <div className={styles.field}>
                <label htmlFor="qr-threshold">Threshold</label>
                <input id="qr-threshold" name="threshold" className={styles.input} placeholder="95" required />
              </div>
              <div className={styles.field}>
                <label htmlFor="qr-comparator">Comparator</label>
                <select id="qr-comparator" name="comparator" className={styles.select} defaultValue="gte">
                  <option value="gte">gte</option>
                  <option value="lte">lte</option>
                  <option value="eq">eq</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="qr-severity">Severity</label>
                <select id="qr-severity" name="severity" className={styles.select} defaultValue="warning">
                  <option value="info">info</option>
                  <option value="warning">warning</option>
                  <option value="critical">critical</option>
                </select>
              </div>
            </div>
            <div className={styles.actions}>
              <Button type="submit">Create Rule</Button>
            </div>
          </form>
        </Card>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Source</th>
              <th>Type</th>
              <th>Quality</th>
              <th>Last Sync</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sourceRows.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{row.type.toUpperCase()}</td>
                <td>{row.quality}</td>
                <td>{row.lastSync}</td>
                <td>
                  <span className={`${styles.badge} ${row.status === 'warning' ? styles.badgeWarn : styles.badgeGood}`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
            {sourceRows.length === 0 ? (
              <tr>
                <td colSpan={5}>No ingestion or quality data found for this organization yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Card title="Recent Ingestion Jobs" description="Manage ingestion job lifecycle.">
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Source</th>
                <th>Type</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeJobs.map((job) => (
                <tr key={job.id}>
                  <td>{job.source_name}</td>
                  <td>{job.source_type.toUpperCase()}</td>
                  <td>{job.status}</td>
                  <td>{formatTimestamp(job.created_at)}</td>
                  <td>
                    <form action={archiveIngestionJobAction}>
                      <input type="hidden" name="id" value={job.id} />
                      <button type="submit" className={`${styles.inlineButton} ${styles.inlineDanger}`}>
                        Archive
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {activeJobs.length === 0 ? (
                <tr>
                  <td colSpan={5}>No active ingestion jobs.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Recent Quality Metrics" description="Manage quality metric lifecycle.">
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Source</th>
                <th>Metric</th>
                <th>Value</th>
                <th>Status</th>
                <th>Measured</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeMetrics.map((metric) => (
                <tr key={metric.id}>
                  <td>{metric.source_name}</td>
                  <td>{metric.metric_name}</td>
                  <td>{metric.metric_value.toFixed(2)}</td>
                  <td>{metric.status}</td>
                  <td>{formatTimestamp(metric.measured_at)}</td>
                  <td>
                    <form action={archiveDataQualityMetricAction}>
                      <input type="hidden" name="id" value={metric.id} />
                      <button type="submit" className={`${styles.inlineButton} ${styles.inlineDanger}`}>
                        Archive
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {activeMetrics.length === 0 ? (
                <tr>
                  <td colSpan={6}>No active quality metrics.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Connector Configurations" description="Data source connector metadata and lifecycle controls.">
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Connector</th>
                <th>Type</th>
                <th>Schedule</th>
                <th>Last Sync</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeConnectors.map((connector) => (
                <tr key={connector.id}>
                  <td>{connector.name}</td>
                  <td>{connector.source_type}</td>
                  <td>{connector.schedule_cron || 'manual'}</td>
                  <td>{formatTimestamp(connector.last_sync_at)}</td>
                  <td>{connector.status}</td>
                  <td>
                    <form action={updateConnectorStatusAction} className={styles.inlineActions}>
                      <input type="hidden" name="id" value={connector.id} />
                      <select name="status" defaultValue={connector.status} className={styles.inlineSelect}>
                        <option value="active">active</option>
                        <option value="paused">paused</option>
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
              {activeConnectors.length === 0 ? (
                <tr>
                  <td colSpan={6}>No connector configurations yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Quality Rules" description="Threshold-driven rule book for automated quality governance.">
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Rule</th>
                <th>Metric</th>
                <th>Condition</th>
                <th>Severity</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeQualityRules.map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.rule_name}</td>
                  <td>{rule.metric_name}</td>
                  <td>
                    {rule.comparator} {Number(rule.threshold).toFixed(2)}
                  </td>
                  <td>{rule.severity}</td>
                  <td>{rule.is_active ? 'Yes' : 'No'}</td>
                  <td>
                    <form action={toggleQualityRuleAction}>
                      <input type="hidden" name="id" value={rule.id} />
                      <input type="hidden" name="isActive" value={rule.is_active ? '0' : '1'} />
                      <button type="submit" className={styles.inlineButton}>
                        {rule.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {activeQualityRules.length === 0 ? (
                <tr>
                  <td colSpan={6}>No quality rules defined yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {showArchived ? (
        <Card title="Archived Ingestion Jobs" description="Restore archived ingestion jobs.">
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {archivedJobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.source_name}</td>
                    <td>{job.source_type.toUpperCase()}</td>
                    <td>{job.status}</td>
                    <td>
                      <form action={restoreIngestionJobAction}>
                        <input type="hidden" name="id" value={job.id} />
                        <button type="submit" className={styles.inlineButton}>
                          Restore
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {archivedJobs.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No archived ingestion jobs.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {showArchived ? (
        <Card title="Archived Quality Metrics" description="Restore archived quality metrics.">
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Metric</th>
                  <th>Value</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {archivedMetrics.map((metric) => (
                  <tr key={metric.id}>
                    <td>{metric.source_name}</td>
                    <td>{metric.metric_name}</td>
                    <td>{metric.metric_value.toFixed(2)}</td>
                    <td>
                      <form action={restoreDataQualityMetricAction}>
                        <input type="hidden" name="id" value={metric.id} />
                        <button type="submit" className={styles.inlineButton}>
                          Restore
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {archivedMetrics.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No archived quality metrics.</td>
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
