import { Card } from '@/components/ui/Card';
import styles from '../../workspace.module.css';

export default function CompliancePage() {
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Compliance Control Center</h1>
        <p className={styles.subtitle}>
          Track operational controls mapped to HIPAA/GDPR expectations for data access, retention, consent, and audit readiness.
        </p>
      </header>

      <div className={styles.grid2}>
        <Card title="Privacy Controls">
          <div className={styles.metric}>Compliant</div>
          <p className={styles.metricLabel}>RLS, tenancy boundaries, and access checks are active.</p>
        </Card>
        <Card title="Consent Coverage">
          <div className={styles.metric}>96%</div>
          <p className={styles.metricLabel}>Records mapped to active consent policies.</p>
        </Card>
        <Card title="Data Retention Exceptions">
          <div className={styles.metric}>3</div>
          <p className={styles.metricLabel}>Pending legal/compliance review.</p>
        </Card>
        <Card title="Regulatory Package Readiness">
          <div className={styles.metric}>82%</div>
          <p className={styles.metricLabel}>Evidence artifacts available for current active studies.</p>
        </Card>
      </div>
    </section>
  );
}
