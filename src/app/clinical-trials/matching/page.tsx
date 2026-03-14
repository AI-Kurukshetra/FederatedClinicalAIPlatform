import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import styles from '../../workspace.module.css';

const trials = [
  { trial: 'Phase III NSCLC Immunotherapy', eligible: 142, screened: 510, status: 'Open' },
  { trial: 'HFpEF Outcomes Registry', eligible: 88, screened: 324, status: 'Open' },
  { trial: 'Post-Market Safety Surveillance', eligible: 205, screened: 702, status: 'Review' },
];

export default function TrialMatchingPage() {
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Clinical Trial Matching</h1>
        <p className={styles.subtitle}>
          Map cohort logic to inclusion/exclusion criteria and identify eligible populations across federated data partners.
        </p>
        <div className={styles.actions}>
          <Button>Create Trial Criteria</Button>
          <Button variant="secondary">Run Feasibility</Button>
        </div>
      </header>

      <div className={styles.grid3}>
        <Card title="Open Trials">
          <div className={styles.metric}>11</div>
          <p className={styles.metricLabel}>Tracked in current workspace</p>
        </Card>
        <Card title="Eligible Patients">
          <div className={styles.metric}>435</div>
          <p className={styles.metricLabel}>After criteria harmonization</p>
        </Card>
        <Card title="Match Precision">
          <div className={styles.metric}>92%</div>
          <p className={styles.metricLabel}>Validated against adjudication sample</p>
        </Card>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Trial</th>
              <th>Eligible</th>
              <th>Screened</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {trials.map((row) => (
              <tr key={row.trial}>
                <td>{row.trial}</td>
                <td>{row.eligible}</td>
                <td>{row.screened}</td>
                <td>
                  <span className={`${styles.badge} ${row.status === 'Review' ? styles.badgeWarn : styles.badgeGood}`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
