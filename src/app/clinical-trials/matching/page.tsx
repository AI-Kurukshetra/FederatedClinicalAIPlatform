import { FlashToast } from '@/components/common/FlashToast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { decodeMessage } from '@/lib/auth/messages';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getPrimaryOrgContext } from '@/server/services/org-context';
import { createClinicalTrialAction, runTrialMatchAction, updateTrialMatchStatusAction } from './actions';
import styles from '../../workspace.module.css';

type TrialMatchingPageProps = {
  searchParams?: Promise<{ notice?: string; error?: string }>;
};

export default async function TrialMatchingPage({ searchParams }: TrialMatchingPageProps) {
  const params = (await searchParams) ?? {};
  const notice = decodeMessage(params.notice);
  const error = decodeMessage(params.error);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const orgContext = user ? await getPrimaryOrgContext(supabase, user.id) : null;

  const { data: studies } = orgContext
    ? await supabase.from('studies').select('id, name').eq('org_id', orgContext.orgId).is('deleted_at', null).order('created_at', { ascending: false })
    : { data: [] as Array<{ id: string; name: string }> };

  const { data: cohorts } = orgContext
    ? await supabase.from('cohorts').select('id, name').eq('org_id', orgContext.orgId).is('deleted_at', null).order('created_at', { ascending: false })
    : { data: [] as Array<{ id: string; name: string }> };

  const { data: trials } = orgContext
    ? await supabase
        .from('clinical_trials')
        .select('id, trial_code, title, phase, status, target_enrollment, study_id, created_at')
        .eq('org_id', orgContext.orgId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(200)
    : {
        data: [] as Array<{
          id: string;
          trial_code: string;
          title: string;
          phase: string;
          status: string;
          target_enrollment: number | null;
          study_id: string | null;
          created_at: string;
        }>,
      };

  const trialIds = (trials ?? []).map((trial) => trial.id);
  const { data: matches } =
    trialIds.length > 0
      ? await supabase
          .from('trial_matches')
          .select('id, trial_id, cohort_id, eligibility_count, screened_count, precision_score, status, matched_at')
          .in('trial_id', trialIds)
          .is('deleted_at', null)
          .order('matched_at', { ascending: false })
          .limit(300)
      : {
          data: [] as Array<{
            id: string;
            trial_id: string;
            cohort_id: string | null;
            eligibility_count: number;
            screened_count: number;
            precision_score: number | null;
            status: string;
            matched_at: string;
          }>,
        };

  const totalEligible = (matches ?? []).reduce((sum, item) => sum + Number(item.eligibility_count ?? 0), 0);
  const avgPrecision =
    (matches ?? []).length > 0
      ? ((matches ?? []).reduce((sum, item) => sum + Number(item.precision_score ?? 0), 0) / (matches ?? []).length).toFixed(1)
      : '0.0';

  const trialNameById = new Map((trials ?? []).map((trial) => [trial.id, `${trial.trial_code} - ${trial.title}`]));
  const studyNameById = new Map((studies ?? []).map((study) => [study.id, study.name]));
  const cohortNameById = new Map((cohorts ?? []).map((cohort) => [cohort.id, cohort.name]));

  return (
    <section className={styles.page}>
      {error ? <FlashToast tone="error" title="Trial action failed" message={error} /> : null}
      {notice ? <FlashToast tone="success" title="Trial matching update" message={notice} /> : null}

      <header className={styles.header}>
        <h1 className={styles.title}>Clinical Trial Matching</h1>
        <p className={styles.subtitle}>
          Maintain trial definitions and run federated eligibility matching against cohort outputs.
        </p>
      </header>

      <div className={styles.grid3}>
        <Card title="Open Trials">
          <div className={styles.metric}>{(trials ?? []).filter((item) => item.status === 'open').length}</div>
          <p className={styles.metricLabel}>Trials currently in open state</p>
        </Card>
        <Card title="Eligible Patients">
          <div className={styles.metric}>{totalEligible}</div>
          <p className={styles.metricLabel}>Aggregate eligible count across latest matches</p>
        </Card>
        <Card title="Match Precision">
          <div className={styles.metric}>{avgPrecision}%</div>
          <p className={styles.metricLabel}>Average precision score across match runs</p>
        </Card>
      </div>

      <div className={styles.grid2}>
        <Card title="Create Trial" description="Register a trial with phase/status and optional study linkage.">
          <form action={createClinicalTrialAction} className={styles.formGridSingle}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="trial-code">Trial Code</label>
                <input id="trial-code" name="trialCode" className={styles.input} placeholder="NCT-2026-101" required />
              </div>
              <div className={styles.field}>
                <label htmlFor="trial-title">Title</label>
                <input id="trial-title" name="title" className={styles.input} placeholder="Phase III NSCLC Immunotherapy" required />
              </div>
              <div className={styles.field}>
                <label htmlFor="trial-phase">Phase</label>
                <select id="trial-phase" name="phase" className={styles.select} defaultValue="III">
                  <option value="I">I</option>
                  <option value="II">II</option>
                  <option value="III">III</option>
                  <option value="IV">IV</option>
                  <option value="observational">observational</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="trial-status">Status</label>
                <select id="trial-status" name="status" className={styles.select} defaultValue="open">
                  <option value="open">open</option>
                  <option value="review">review</option>
                  <option value="paused">paused</option>
                  <option value="closed">closed</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="trial-study">Study (optional)</label>
                <select id="trial-study" name="studyId" className={styles.select} defaultValue="">
                  <option value="">Unlinked</option>
                  {(studies ?? []).map((study) => (
                    <option key={study.id} value={study.id}>
                      {study.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="trial-target">Target Enrollment</label>
                <input id="trial-target" name="targetEnrollment" className={styles.input} placeholder="350" />
              </div>
            </div>
            <div className={styles.actions}>
              <Button type="submit">Create Trial</Button>
            </div>
          </form>
        </Card>

        <Card title="Run Match" description="Generate a trial eligibility snapshot for a trial/cohort pair.">
          <form action={runTrialMatchAction} className={styles.formGridSingle}>
            <div className={styles.field}>
              <label htmlFor="match-trial">Trial</label>
              <select id="match-trial" name="trialId" className={styles.select} required>
                {(trials ?? []).map((trial) => (
                  <option key={trial.id} value={trial.id}>
                    {trial.trial_code} - {trial.title}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="match-cohort">Cohort (optional)</label>
              <select id="match-cohort" name="cohortId" className={styles.select} defaultValue="">
                <option value="">Use generic match baseline</option>
                {(cohorts ?? []).map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.actions}>
              <Button type="submit">Run Matching</Button>
            </div>
          </form>
        </Card>
      </div>

      <Card title="Trials">
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Trial</th>
                <th>Phase</th>
                <th>Status</th>
                <th>Study</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {(trials ?? []).map((trial) => (
                <tr key={trial.id}>
                  <td>{trial.trial_code} - {trial.title}</td>
                  <td>{trial.phase}</td>
                  <td>{trial.status}</td>
                  <td>{trial.study_id ? studyNameById.get(trial.study_id) ?? trial.study_id : 'Unlinked'}</td>
                  <td>{trial.target_enrollment ?? '-'}</td>
                </tr>
              ))}
              {(trials ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5}>No trials found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Match History">
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Trial</th>
                <th>Cohort</th>
                <th>Eligible</th>
                <th>Screened</th>
                <th>Precision</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(matches ?? []).map((match) => (
                <tr key={match.id}>
                  <td>{trialNameById.get(match.trial_id) ?? match.trial_id}</td>
                  <td>{match.cohort_id ? cohortNameById.get(match.cohort_id) ?? match.cohort_id : 'Unassigned'}</td>
                  <td>{match.eligibility_count}</td>
                  <td>{match.screened_count}</td>
                  <td>{match.precision_score != null ? `${match.precision_score.toFixed(2)}%` : '-'}</td>
                  <td>{match.status}</td>
                  <td>
                    <form action={updateTrialMatchStatusAction} className={styles.inlineActions}>
                      <input type="hidden" name="id" value={match.id} />
                      <select name="status" defaultValue={match.status} className={styles.inlineSelect}>
                        <option value="open">open</option>
                        <option value="review">review</option>
                        <option value="paused">paused</option>
                        <option value="closed">closed</option>
                      </select>
                      <button type="submit" className={styles.inlineButton}>
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {(matches ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7}>No trial matches found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
