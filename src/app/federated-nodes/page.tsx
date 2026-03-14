import { FlashToast } from '@/components/common/FlashToast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { decodeMessage } from '@/lib/auth/messages';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getPrimaryOrgContext } from '@/server/services/org-context';
import {
  archiveFederatedNodeAction,
  claimNextOperationAction,
  createFederatedNodeAction,
  queueFederatedOperationAction,
  restoreFederatedNodeAction,
  runConnectivityCheckAction,
  updateFederatedNodeStatusAction,
  updateFederatedOperationStatusAction,
} from './actions';
import styles from '../workspace.module.css';

function formatHeartbeat(value: string | null) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString();
}

type FederatedNodesPageProps = {
  searchParams?: Promise<{
    notice?: string;
    error?: string;
    showArchived?: string;
  }>;
};

export default async function FederatedNodesPage({ searchParams }: FederatedNodesPageProps) {
  const params = (await searchParams) ?? {};
  const notice = decodeMessage(params.notice);
  const error = decodeMessage(params.error);
  const showArchived = params.showArchived === '1';

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const orgContext = user ? await getPrimaryOrgContext(supabase, user.id) : null;

  const { data: nodes } = orgContext
    ? await supabase
        .from('federated_nodes')
        .select('id, name, region, status, last_heartbeat_at, deleted_at')
        .eq('org_id', orgContext.orgId)
        .order('created_at', { ascending: false })
    : {
        data: [] as Array<{
          id: string;
          name: string;
          region: string;
          status: string;
          last_heartbeat_at: string | null;
          deleted_at: string | null;
        }>,
      };

  const { data: operations } = orgContext
    ? await supabase
        .from('federated_operations')
        .select('id, node_id, operation_type, status, priority, queued_at, started_at, finished_at')
        .eq('org_id', orgContext.orgId)
        .is('deleted_at', null)
        .order('queued_at', { ascending: false })
        .limit(120)
    : {
        data: [] as Array<{
          id: string;
          node_id: string | null;
          operation_type: string;
          status: string;
          priority: number;
          queued_at: string;
          started_at: string | null;
          finished_at: string | null;
        }>,
      };

  const activeNodes = (nodes ?? []).filter((node) => !node.deleted_at);
  const archivedNodes = (nodes ?? []).filter((node) => Boolean(node.deleted_at));

  const nodeRows = activeNodes.map((node) => ({
    id: node.id,
    site: node.name,
    region: node.region,
    heartbeat: formatHeartbeat(node.last_heartbeat_at),
    status: node.status,
  }));

  const onlineCount = nodeRows.filter((item) => item.status === 'online').length;
  const degradedCount = nodeRows.filter((item) => item.status === 'degraded').length;
  const queuedOperations = (operations ?? []).filter((operation) => operation.status === 'queued').length;

  return (
    <section className={styles.page}>
      {error ? <FlashToast tone="error" title="Node action failed" message={error} /> : null}
      {notice ? <FlashToast tone="success" title="Node update" message={notice} /> : null}
      <header className={styles.header}>
        <h1 className={styles.title}>Federated Nodes</h1>
        <p className={styles.subtitle}>
          Monitor node health and manage queued/running operations with explicit worker-style lifecycle transitions.
        </p>
        <div className={styles.actions}>
          <Button>Register Node</Button>
          <form action={runConnectivityCheckAction}>
            <Button variant="secondary" type="submit">
              Run Connectivity Check
            </Button>
          </form>
          {showArchived ? (
            <a href="/federated-nodes" className={styles.inlineButton}>
              Hide Archived
            </a>
          ) : (
            <a href="/federated-nodes?showArchived=1" className={styles.inlineButton}>
              Show Archived ({archivedNodes.length})
            </a>
          )}
        </div>
      </header>

      <div className={styles.grid3}>
        <Card title="Connected Nodes">
          <div className={styles.metric}>{nodeRows.length}</div>
          <p className={styles.metricLabel}>Federated institutions currently linked</p>
        </Card>
        <Card title="Online Nodes">
          <div className={styles.metric}>{onlineCount}</div>
          <p className={styles.metricLabel}>Healthy nodes available for scheduling</p>
        </Card>
        <Card title="Queued Operations">
          <div className={styles.metric}>{queuedOperations}</div>
          <p className={styles.metricLabel}>Operations waiting for worker claim</p>
        </Card>
      </div>

      <Card title="Register Federated Node" description="Add a partner node for distributed compute and data operations.">
        <form action={createFederatedNodeAction} className={styles.formGrid}>
          <div className={styles.field}>
            <label htmlFor="node-name">Node Name</label>
            <input id="node-name" name="name" className={styles.input} placeholder="Mayo Partner Node" required />
          </div>
          <div className={styles.field}>
            <label htmlFor="node-region">Region</label>
            <input id="node-region" name="region" className={styles.input} placeholder="us-east" required />
          </div>
          <div className={styles.field}>
            <label htmlFor="node-endpoint">Endpoint URL</label>
            <input id="node-endpoint" name="endpointUrl" className={styles.input} placeholder="https://node.example.internal" />
          </div>
          <div className={styles.field}>
            <label htmlFor="node-status">Status</label>
            <select id="node-status" name="status" className={styles.select} defaultValue="online">
              <option value="online">online</option>
              <option value="degraded">degraded</option>
              <option value="offline">offline</option>
              <option value="maintenance">maintenance</option>
            </select>
          </div>
          <div className={styles.actions}>
            <Button type="submit">Create Node</Button>
          </div>
        </form>
      </Card>

      <div className={styles.grid2}>
        <Card title="Queue Operation" description="Create worker queue items with explicit priority.">
          <form action={queueFederatedOperationAction} className={styles.formGridSingle}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="op-node">Node (optional)</label>
                <select id="op-node" name="nodeId" className={styles.select} defaultValue="">
                  <option value="">Any available node</option>
                  {activeNodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="op-type">Type</label>
                <select id="op-type" name="operationType" className={styles.select} defaultValue="connectivity_check">
                  <option value="connectivity_check">connectivity_check</option>
                  <option value="quality_scan">quality_scan</option>
                  <option value="cohort_run">cohort_run</option>
                  <option value="analysis_run">analysis_run</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="op-priority">Priority</label>
                <input id="op-priority" name="priority" className={styles.input} defaultValue="50" required />
              </div>
            </div>
            <div className={styles.actions}>
              <Button type="submit">Queue Operation</Button>
            </div>
          </form>
        </Card>

        <Card title="Claim Next Operation" description="Simulate worker pulling the next eligible queued item.">
          <form action={claimNextOperationAction} className={styles.formGridSingle}>
            <div className={styles.field}>
              <label htmlFor="claim-node">Worker Node</label>
              <select id="claim-node" name="nodeId" className={styles.select} required>
                {activeNodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.actions}>
              <Button type="submit">Claim</Button>
            </div>
          </form>
        </Card>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Node</th>
              <th>Region</th>
              <th>Last Heartbeat</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {nodeRows.map((row) => (
              <tr key={row.id}>
                <td>{row.site}</td>
                <td>{row.region}</td>
                <td>{row.heartbeat}</td>
                <td>
                  <span className={`${styles.badge} ${row.status === 'degraded' ? styles.badgeWarn : styles.badgeGood}`}>
                    {row.status}
                  </span>
                </td>
                <td>
                  <div className={styles.inlineActions}>
                    <form action={updateFederatedNodeStatusAction} className={styles.inlineActions}>
                      <input type="hidden" name="id" value={row.id} />
                      <select name="status" defaultValue={row.status} className={styles.inlineSelect}>
                        <option value="online">online</option>
                        <option value="degraded">degraded</option>
                        <option value="offline">offline</option>
                        <option value="maintenance">maintenance</option>
                      </select>
                      <button type="submit" className={styles.inlineButton}>
                        Save
                      </button>
                    </form>
                    <form action={archiveFederatedNodeAction}>
                      <input type="hidden" name="id" value={row.id} />
                      <button type="submit" className={`${styles.inlineButton} ${styles.inlineDanger}`}>
                        Archive
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {nodeRows.length === 0 ? (
              <tr>
                <td colSpan={5}>No nodes found for this organization yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Card title="Operation Queue" description="Queued/running/completed operation records across all nodes.">
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Operation</th>
                <th>Node</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Queued</th>
                <th>Started</th>
                <th>Finished</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(operations ?? []).map((operation) => (
                <tr key={operation.id}>
                  <td>{operation.operation_type}</td>
                  <td>{activeNodes.find((node) => node.id === operation.node_id)?.name ?? operation.node_id ?? 'Unassigned'}</td>
                  <td>{operation.status}</td>
                  <td>{operation.priority}</td>
                  <td>{formatHeartbeat(operation.queued_at)}</td>
                  <td>{formatHeartbeat(operation.started_at)}</td>
                  <td>{formatHeartbeat(operation.finished_at)}</td>
                  <td>
                    <form action={updateFederatedOperationStatusAction} className={styles.inlineActions}>
                      <input type="hidden" name="operationId" value={operation.id} />
                      <select name="status" defaultValue={operation.status} className={styles.inlineSelect}>
                        <option value="queued">queued</option>
                        <option value="running">running</option>
                        <option value="completed">completed</option>
                        <option value="failed">failed</option>
                        <option value="cancelled">cancelled</option>
                      </select>
                      <button type="submit" className={styles.inlineButton}>
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {(operations ?? []).length === 0 ? (
                <tr>
                  <td colSpan={8}>No federated operations queued yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {showArchived ? (
        <Card title="Archived Federated Nodes" description="Restore archived nodes into active orchestration pool.">
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Node</th>
                  <th>Region</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {archivedNodes.map((node) => (
                  <tr key={node.id}>
                    <td>{node.name}</td>
                    <td>{node.region}</td>
                    <td>
                      <form action={restoreFederatedNodeAction}>
                        <input type="hidden" name="id" value={node.id} />
                        <button type="submit" className={styles.inlineButton}>
                          Restore
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {archivedNodes.length === 0 ? (
                  <tr>
                    <td colSpan={3}>No archived nodes.</td>
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
