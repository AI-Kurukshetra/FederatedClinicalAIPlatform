import Link from 'next/link';
import styles from './page.module.css';

const featureCards = [
  {
    title: 'Study Workspace',
    description:
      'Run end-to-end study operations with role-based access, structured collaboration, and auditability by default.',
  },
  {
    title: 'Cohort Builder',
    description:
      'Create cohort definitions, version them safely, and execute repeatable runs with clear result tracking.',
  },
  {
    title: 'Clinical Data Readiness',
    description:
      'Prepare your data foundation for quality checks, analytics, and downstream feasibility workflows.',
  },
];

const workflowSteps = [
  'Create organization and assign member roles',
  'Set up study and collaboration settings',
  'Define cohort logic and publish versions',
  'Run cohorts and monitor execution outputs',
];

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>Nference Research OS</div>
        <nav className={styles.nav}>
          <a href="#platform">Platform</a>
          <a href="#workflow">Workflow</a>
          <a href="#security">Security</a>
        </nav>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>Clinical Research Platform</p>
        <h1>Build high-confidence studies with secure cohort intelligence.</h1>
        <p className={styles.heroText}>
          A production-ready foundation for organizations, studies, and cohort execution built on
          strict access control and migration-driven data governance.
        </p>
        <div className={styles.heroActions}>
          <Link href="/dashboard" className={styles.primaryButton}>
            Open Dashboard
          </Link>
          <a href="#workflow" className={styles.secondaryButton}>
            View Workflow
          </a>
        </div>
      </section>

      <section id="platform" className={styles.features}>
        {featureCards.map((feature) => (
          <article key={feature.title} className={styles.card}>
            <h2>{feature.title}</h2>
            <p>{feature.description}</p>
          </article>
        ))}
      </section>

      <section id="workflow" className={styles.workflow}>
        <h2>Execution workflow</h2>
        <ol>
          {workflowSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section id="security" className={styles.security}>
        <h2>Security and compliance first</h2>
        <p>
          Multi-tenant boundaries, row-level access control, and audit-oriented architecture are
          built into the product baseline from day one.
        </p>
        <div className={styles.healthLinks}>
          <a href="/api/health/db">DB Health</a>
          <a href="/api/health/auth">Auth Health</a>
        </div>
      </section>
    </main>
  );
}
