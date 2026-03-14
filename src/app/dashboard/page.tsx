import Link from 'next/link';
import { FlashToast } from '@/components/common/FlashToast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { decodeMessage } from '@/lib/auth/messages';
import styles from './page.module.css';

const metrics = [
  { title: 'Active Studies', value: '12', trend: '+3', meta: 'Across oncology, cardio, and rare disease programs' },
  { title: 'Cohort Definitions', value: '34', trend: '+8', meta: 'Version-controlled criteria sets across organizations' },
  { title: 'Recent Cohort Runs', value: '9', trend: '+2', meta: 'Executed in the last 24 hours' },
  { title: 'Compliance Status', value: 'Healthy', trend: '100%', meta: 'Audit trail and access logging active' },
];

const operations = [
  {
    title: 'Ingestion Health',
    value: '98.7%',
    note: 'Pipelines from connected data sources completed on schedule.',
  },
  {
    title: 'Node Uptime',
    value: '22 / 23',
    note: 'One federated node is in maintenance mode for planned upgrades.',
  },
  {
    title: 'Pending Reviews',
    value: '4',
    note: 'Study-level approvals waiting on compliance and legal sign-off.',
  },
  {
    title: 'Trial Matches',
    value: '17',
    note: 'Potential patient matches generated from the latest criteria set.',
  },
];

const roadmap = [
  { title: 'Finalize Oncology Cohort v2.4', owner: 'Cohort Ops', eta: 'Today' },
  { title: 'Run Cross-Site Feasibility Sweep', owner: 'Analytics', eta: 'Mar 15' },
  { title: 'Complete Access Audit Export', owner: 'Compliance', eta: 'Mar 16' },
  { title: 'Publish Readiness Summary', owner: 'Program Lead', eta: 'Mar 17' },
];

const quickActions = [
  {
    href: '/studies',
    label: 'Manage Studies',
    description: 'Update protocols, ownership, and enrollment milestones.',
  },
  {
    href: '/cohorts',
    label: 'Review Cohorts',
    description: 'Refine inclusion and exclusion logic before execution.',
  },
  {
    href: '/analytics',
    label: 'Open Analytics',
    description: 'Inspect run outcomes and monitor processing trends.',
  },
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

      <header className={styles.hero}>
        <div className={styles.heroBody}>
          <p className={styles.eyebrow}>Research Operations Dashboard</p>
          <h1 className={styles.title}>Research Command Center</h1>
          <p className={styles.subtitle}>
            Monitor federated study operations, cohort execution, and compliance readiness from a single professional control
            plane.
          </p>
          <div className={styles.actions}>
            <Link href="/studies">
              <Button>Open Studies</Button>
            </Link>
            <Link href="/cohorts">
              <Button variant="secondary">Open Cohorts</Button>
            </Link>
            <Link href="/ask-ai">
              <Button variant="secondary">Ask AI</Button>
            </Link>
          </div>
        </div>
        <div className={styles.heroStatus}>
          <p className={styles.statusLabel}>Environment Status</p>
          <p className={styles.statusValue}>All critical systems operational</p>
          <p className={styles.statusMeta}>Updated moments ago from ingestion, federation, and compliance checks.</p>
        </div>
      </header>

      <div className={styles.metricGrid}>
        {metrics.map((metric) => (
          <Card key={metric.title} title={metric.title} className={styles.metricCard}>
            <div className={styles.metricValue}>{metric.value}</div>
            <p className={styles.metricTrend}>{metric.trend} vs last checkpoint</p>
            <p className={styles.metricMeta}>{metric.meta}</p>
          </Card>
        ))}
      </div>

      <div className={styles.contentGrid}>
        <Card title="Operational Snapshot" description="Real-time summary of mission-critical workspace health." className={styles.panel}>
          <ul className={styles.operationList}>
            {operations.map((item) => (
              <li key={item.title} className={styles.operationItem}>
                <div>
                  <p className={styles.operationTitle}>{item.title}</p>
                  <p className={styles.operationNote}>{item.note}</p>
                </div>
                <span className={styles.operationValue}>{item.value}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Current Priorities" description="Near-term deliverables aligned to the active research calendar." className={styles.panel}>
          <ol className={styles.roadmapList}>
            {roadmap.map((item) => (
              <li key={item.title} className={styles.roadmapItem}>
                <div>
                  <p className={styles.roadmapTitle}>{item.title}</p>
                  <p className={styles.roadmapMeta}>Owner: {item.owner}</p>
                </div>
                <span className={styles.roadmapEta}>{item.eta}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card title="Quick Actions" description="Jump directly into key modules and keep execution momentum high." className={styles.quickCard}>
        <div className={styles.quickGrid}>
          {quickActions.map((item) => (
            <Link key={item.href} href={item.href} className={styles.quickLink}>
              <span className={styles.quickLabel}>{item.label}</span>
              <span className={styles.quickDescription}>{item.description}</span>
              <span className={styles.quickArrow}>Explore</span>
            </Link>
          ))}
        </div>
      </Card>
    </section>
  );
}
