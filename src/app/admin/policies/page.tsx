import { FlashToast } from '@/components/common/FlashToast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { decodeMessage } from '@/lib/auth/messages';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getPrimaryOrgContext } from '@/server/services/org-context';
import { createPolicyConfigAction, updatePolicyStatusAction } from './actions';
import styles from '../../workspace.module.css';

type PoliciesPageProps = {
  searchParams?: Promise<{ notice?: string; error?: string }>;
};

export default async function PoliciesPage({ searchParams }: PoliciesPageProps) {
  const params = (await searchParams) ?? {};
  const notice = decodeMessage(params.notice);
  const error = decodeMessage(params.error);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const orgContext = user ? await getPrimaryOrgContext(supabase, user.id) : null;

  const { data: policies } = orgContext
    ? await supabase
        .from('policy_configs')
        .select('id, policy_key, policy_name, policy_type, status, version_no, created_at')
        .eq('org_id', orgContext.orgId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(200)
    : {
        data: [] as Array<{
          id: string;
          policy_key: string;
          policy_name: string;
          policy_type: string;
          status: string;
          version_no: number;
          created_at: string;
        }>,
      };

  const activeCount = (policies ?? []).filter((item) => item.status === 'active').length;
  const draftCount = (policies ?? []).filter((item) => item.status === 'draft').length;

  return (
    <section className={styles.page}>
      {error ? <FlashToast tone="error" title="Policy action failed" message={error} /> : null}
      {notice ? <FlashToast tone="success" title="Policy update" message={notice} /> : null}

      <header className={styles.header}>
        <h1 className={styles.title}>Policy Configuration</h1>
        <p className={styles.subtitle}>
          Manage compliance policy versions for access, retention, de-identification, and regional controls.
        </p>
      </header>

      <div className={styles.grid3}>
        <Card title="Total Policies">
          <div className={styles.metric}>{policies?.length ?? 0}</div>
          <p className={styles.metricLabel}>Versioned policy rows in workspace</p>
        </Card>
        <Card title="Active">
          <div className={styles.metric}>{activeCount}</div>
          <p className={styles.metricLabel}>Policies currently enforced</p>
        </Card>
        <Card title="Draft">
          <div className={styles.metric}>{draftCount}</div>
          <p className={styles.metricLabel}>Policies pending compliance sign-off</p>
        </Card>
      </div>

      <Card title="Create Policy Version" description="Add a new policy version with JSON configuration payload.">
        <form action={createPolicyConfigAction} className={styles.formGridSingle}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="policy-key">Policy Key</label>
              <input id="policy-key" name="policyKey" className={styles.input} placeholder="hipaa_minimum_necessary" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="policy-name">Policy Name</label>
              <input id="policy-name" name="policyName" className={styles.input} placeholder="HIPAA Minimum Necessary Access" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="policy-type">Type</label>
              <select id="policy-type" name="policyType" className={styles.select} defaultValue="access">
                <option value="access">access</option>
                <option value="retention">retention</option>
                <option value="deidentification">deidentification</option>
                <option value="regional_restriction">regional_restriction</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="policy-status">Status</label>
              <select id="policy-status" name="status" className={styles.select} defaultValue="draft">
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="archived">archived</option>
              </select>
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="policy-config-json">Config JSON</label>
            <textarea id="policy-config-json" name="configJson" className={styles.textarea} placeholder='{"allowedRoles":["owner","admin"],"maskPhi":true}' />
          </div>
          <div className={styles.actions}>
            <Button type="submit">Create Policy Version</Button>
          </div>
        </form>
      </Card>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Key</th>
              <th>Name</th>
              <th>Type</th>
              <th>Version</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(policies ?? []).map((policy) => (
              <tr key={policy.id}>
                <td>{policy.policy_key}</td>
                <td>{policy.policy_name}</td>
                <td>{policy.policy_type}</td>
                <td>v{policy.version_no}</td>
                <td>{policy.status}</td>
                <td>
                  <form action={updatePolicyStatusAction} className={styles.inlineActions}>
                    <input type="hidden" name="id" value={policy.id} />
                    <select name="status" defaultValue={policy.status} className={styles.inlineSelect}>
                      <option value="draft">draft</option>
                      <option value="active">active</option>
                      <option value="archived">archived</option>
                    </select>
                    <button type="submit" className={styles.inlineButton}>
                      Save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(policies ?? []).length === 0 ? (
              <tr>
                <td colSpan={6}>No policy configurations found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
