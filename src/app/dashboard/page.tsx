import Link from 'next/link';
import { FlashToast } from '@/components/common/FlashToast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { decodeMessage } from '@/lib/auth/messages';
import styles from './page.module.css';

const metrics = [
  { title: 'Active Studies', value: '12', meta: 'Across oncology, cardio, and rare disease programs' },
  { title: 'Cohort Definitions', value: '34', meta: 'Version-controlled criteria sets across organizations' },
  { title: 'Recent Cohort Runs', value: '9', meta: 'Executed in the last 24 hours' },
  { title: 'Compliance Status', value: 'Healthy', meta: 'Audit trail and access logging active' },
];

type DashboardPageProps = {
  searchParams?: Promise<{
    notice?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = (await searchParams) ?? {};
  const notice = decodeMessage(params.notice);

  return (
    <section className={styles.page}>
      {notice ? <FlashToast tone="success" message={notice} title="Workspace update" /> : null}
      <header className={styles.header}>
        <h1 className={styles.title}>Research Command Center</h1>
        <p className={styles.subtitle}>
          Monitor federated study operations, cohort execution, and compliance readiness in one place.
        </p>
        <div className={styles.actions}>
          <Link href="/studies">
            <Button>Open Studies</Button>
          </Link>
          <Link href="/cohorts">
            <Button variant="secondary">Open Cohorts</Button>
          </Link>
        </div>
      </header>

      <div className={styles.grid}>
        {metrics.map((metric) => (
          <Card key={metric.title} title={metric.title}>
            <div className={styles.metricValue}>{metric.value}</div>
            <p className={styles.metricMeta}>{metric.meta}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
