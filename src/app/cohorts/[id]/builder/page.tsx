import Link from 'next/link';
import { FlashToast } from '@/components/common/FlashToast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { decodeMessage } from '@/lib/auth/messages';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createCohortVersionFromBuilderAction } from '../actions';
import styles from '../../../workspace.module.css';

type CohortBuilderPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ notice?: string; error?: string }>;
};

function prettyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export default async function CohortBuilderPage({ params, searchParams }: CohortBuilderPageProps) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const notice = decodeMessage(query.notice);
  const error = decodeMessage(query.error);

  const supabase = await createServerSupabaseClient();
  const cohortResult = await supabase
    .from('cohorts')
    .select('id, name, description')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  const latestVersionResult = await supabase
    .from('cohort_versions')
    .select('id, version_no, definition_json, created_at')
    .eq('cohort_id', id)
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cohortResult.data) {
    return (
      <section className={styles.page}>
        <FlashToast tone="error" title="Cohort not found" message="Cannot open builder because the cohort does not exist." />
        <Link href="/cohorts" className={styles.inlineButton}>
          Back to cohorts
        </Link>
      </section>
    );
  }

  const starterDefinition = latestVersionResult.data?.definition_json ?? {
    logicalOperator: 'AND',
    criteria: [
      { field: 'diagnosis.icd10', operator: 'in', value: ['C34.9'] },
      { field: 'biomarker.pdl1_percent', operator: 'gte', value: 50 },
    ],
    exclusions: [{ field: 'age', operator: 'lt', value: 18 }],
  };

  return (
    <section className={styles.page}>
      {error ? <FlashToast tone="error" title="Builder action failed" message={error} /> : null}
      {notice ? <FlashToast tone="success" title="Builder update" message={notice} /> : null}

      <header className={styles.header}>
        <h1 className={styles.title}>Cohort Builder: {cohortResult.data.name}</h1>
        <p className={styles.subtitle}>
          Create versioned, auditable cohort definitions for federated execution. Keep criteria JSON deterministic for reproducible runs.
        </p>
        <div className={styles.actions}>
          <Link href={`/cohorts/${id}`} className={styles.inlineButton}>
            Back to detail
          </Link>
          <Link href="/cohorts" className={styles.inlineButton}>
            Back to cohorts
          </Link>
        </div>
      </header>

      <div className={styles.grid2}>
        <Card title="Current Cohort Context">
          <p className={styles.metricLabel}>Description</p>
          <p>{cohortResult.data.description || 'No description added yet.'}</p>
          <p className={styles.metricLabel} style={{ marginTop: '0.75rem' }}>
            Latest Version
          </p>
          <p>
            {latestVersionResult.data ? `v${latestVersionResult.data.version_no}` : 'No versions yet'}
          </p>
        </Card>

        <Card title="Version Publish Rules">
          <p className={styles.metricLabel}>Before publishing</p>
          <ul style={{ marginLeft: '1.1rem' }}>
            <li>Use explicit operators and units in rule definitions.</li>
            <li>Avoid non-deterministic placeholders in criteria JSON.</li>
            <li>Attach downstream study/run notes through audit metadata if needed.</li>
          </ul>
        </Card>
      </div>

      <Card title="Publish New Version" description="Submit a valid JSON object. Version number auto-increments.">
        <form action={createCohortVersionFromBuilderAction} className={styles.formGridSingle}>
          <input type="hidden" name="cohortId" value={id} />
          <div className={styles.field}>
            <label htmlFor="definition-json">Definition JSON</label>
            <textarea id="definition-json" name="definitionJson" className={styles.textarea} style={{ minHeight: '300px', fontFamily: 'monospace' }} defaultValue={prettyJson(starterDefinition)} required />
          </div>
          <div className={styles.actions}>
            <Button type="submit">Publish Version</Button>
          </div>
        </form>
      </Card>
    </section>
  );
}
