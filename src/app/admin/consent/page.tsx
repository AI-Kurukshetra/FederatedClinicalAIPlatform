import { FlashToast } from '@/components/common/FlashToast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { decodeMessage } from '@/lib/auth/messages';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getPrimaryOrgContext } from '@/server/services/org-context';
import { createConsentRecordAction, updateConsentStatusAction } from './actions';
import styles from '../../workspace.module.css';

type ConsentPageProps = {
  searchParams?: Promise<{ notice?: string; error?: string }>;
};

function formatDateTime(value: string | null) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString();
}

export default async function ConsentPage({ searchParams }: ConsentPageProps) {
  const params = (await searchParams) ?? {};
  const notice = decodeMessage(params.notice);
  const error = decodeMessage(params.error);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const orgContext = user ? await getPrimaryOrgContext(supabase, user.id) : null;

  const { data: records } = orgContext
    ? await supabase
        .from('consent_records')
        .select('id, subject_ref, consent_type, status, effective_at, expires_at, evidence_ref, created_at')
        .eq('org_id', orgContext.orgId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(200)
    : {
        data: [] as Array<{
          id: string;
          subject_ref: string;
          consent_type: string;
          status: string;
          effective_at: string;
          expires_at: string | null;
          evidence_ref: string | null;
          created_at: string;
        }>,
      };

  const grantedCount = (records ?? []).filter((record) => record.status === 'granted').length;
  const revokedCount = (records ?? []).filter((record) => record.status === 'revoked').length;

  return (
    <section className={styles.page}>
      {error ? <FlashToast tone="error" title="Consent action failed" message={error} /> : null}
      {notice ? <FlashToast tone="success" title="Consent update" message={notice} /> : null}

      <header className={styles.header}>
        <h1 className={styles.title}>Consent Management</h1>
        <p className={styles.subtitle}>
          Maintain auditable patient/subject consent lifecycle with status controls and evidence references.
        </p>
      </header>

      <div className={styles.grid3}>
        <Card title="Total Records">
          <div className={styles.metric}>{records?.length ?? 0}</div>
          <p className={styles.metricLabel}>Consent records in current organization</p>
        </Card>
        <Card title="Granted">
          <div className={styles.metric}>{grantedCount}</div>
          <p className={styles.metricLabel}>Currently active consent records</p>
        </Card>
        <Card title="Revoked">
          <div className={styles.metric}>{revokedCount}</div>
          <p className={styles.metricLabel}>Revoked consent requiring exclusion controls</p>
        </Card>
      </div>

      <Card title="Create Consent Record" description="Register a new consent decision and optional expiration.">
        <form action={createConsentRecordAction} className={styles.formGridSingle}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="consent-subject">Subject Reference</label>
              <input id="consent-subject" name="subjectRef" className={styles.input} placeholder="patient-12345" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="consent-type">Consent Type</label>
              <select id="consent-type" name="consentType" className={styles.select} defaultValue="research">
                <option value="research">research</option>
                <option value="trial_matching">trial_matching</option>
                <option value="genomics">genomics</option>
                <option value="data_sharing">data_sharing</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="consent-status">Status</label>
              <select id="consent-status" name="status" className={styles.select} defaultValue="granted">
                <option value="granted">granted</option>
                <option value="pending">pending</option>
                <option value="revoked">revoked</option>
                <option value="expired">expired</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="consent-expires">Expires At (optional)</label>
              <input id="consent-expires" name="expiresAt" type="datetime-local" className={styles.input} />
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="consent-evidence">Evidence Reference (optional)</label>
            <input id="consent-evidence" name="evidenceRef" className={styles.input} placeholder="consent-doc://2026/03/14/patient-12345" />
          </div>
          <div className={styles.actions}>
            <Button type="submit">Create Record</Button>
          </div>
        </form>
      </Card>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Type</th>
              <th>Status</th>
              <th>Effective</th>
              <th>Expires</th>
              <th>Evidence</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(records ?? []).map((record) => (
              <tr key={record.id}>
                <td>{record.subject_ref}</td>
                <td>{record.consent_type}</td>
                <td>{record.status}</td>
                <td>{formatDateTime(record.effective_at)}</td>
                <td>{formatDateTime(record.expires_at)}</td>
                <td>{record.evidence_ref || '-'}</td>
                <td>
                  <form action={updateConsentStatusAction} className={styles.inlineActions}>
                    <input type="hidden" name="id" value={record.id} />
                    <select name="status" defaultValue={record.status} className={styles.inlineSelect}>
                      <option value="granted">granted</option>
                      <option value="pending">pending</option>
                      <option value="revoked">revoked</option>
                      <option value="expired">expired</option>
                    </select>
                    <button type="submit" className={styles.inlineButton}>
                      Save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(records ?? []).length === 0 ? (
              <tr>
                <td colSpan={7}>No consent records found for this organization.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
