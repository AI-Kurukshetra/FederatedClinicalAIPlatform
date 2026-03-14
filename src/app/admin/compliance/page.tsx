import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getPrimaryOrgContext } from '@/server/services/org-context';
import styles from '../../workspace.module.css';

export default async function CompliancePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const orgContext = user ? await getPrimaryOrgContext(supabase, user.id) : null;

  const { data: consents } = orgContext
    ? await supabase.from('consent_records').select('id, status').eq('org_id', orgContext.orgId).is('deleted_at', null)
    : { data: [] as Array<{ id: string; status: string }> };

  const { data: policies } = orgContext
    ? await supabase.from('policy_configs').select('id, status').eq('org_id', orgContext.orgId).is('deleted_at', null)
    : { data: [] as Array<{ id: string; status: string }> };

  const consentCoverage =
    (consents?.length ?? 0) > 0 ? `${(((consents ?? []).filter((item) => item.status === 'granted').length / (consents?.length ?? 1)) * 100).toFixed(1)}%` : '0.0%';
  const activePolicies = (policies ?? []).filter((item) => item.status === 'active').length;
  const draftPolicies = (policies ?? []).filter((item) => item.status === 'draft').length;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Compliance Control Center</h1>
        <p className={styles.subtitle}>
          Monitor operational controls mapped to HIPAA/GDPR requirements across consent, policy, and audit governance.
        </p>
        <div className={styles.actions}>
          <Link href="/admin/consent" className={styles.inlineButton}>
            Manage Consent
          </Link>
          <Link href="/admin/policies" className={styles.inlineButton}>
            Manage Policies
          </Link>
          <Link href="/admin/audit" className={styles.inlineButton}>
            Open Audit
          </Link>
        </div>
      </header>

      <div className={styles.grid2}>
        <Card title="Consent Coverage">
          <div className={styles.metric}>{consentCoverage}</div>
          <p className={styles.metricLabel}>Granted consent share in active records</p>
        </Card>
        <Card title="Policy Controls">
          <div className={styles.metric}>{activePolicies}</div>
          <p className={styles.metricLabel}>Active policy versions currently enforced</p>
        </Card>
        <Card title="Draft Policies">
          <div className={styles.metric}>{draftPolicies}</div>
          <p className={styles.metricLabel}>Policies pending compliance sign-off</p>
        </Card>
        <Card title="Retention Policy">
          <div className={styles.metric}>7 years</div>
          <p className={styles.metricLabel}>Regulatory-ready retention baseline</p>
        </Card>
      </div>
    </section>
  );
}
