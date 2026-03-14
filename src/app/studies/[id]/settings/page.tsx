import Link from 'next/link';
import { FlashToast } from '@/components/common/FlashToast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { decodeMessage } from '@/lib/auth/messages';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { addStudyMemberAction, removeStudyMemberAction, updateStudyMemberRoleAction } from './actions';
import styles from '../../../workspace.module.css';

type StudySettingsPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ notice?: string; error?: string }>;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export default async function StudySettingsPage({ params, searchParams }: StudySettingsPageProps) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const notice = decodeMessage(query.notice);
  const error = decodeMessage(query.error);

  const supabase = await createServerSupabaseClient();
  const studyResult = await supabase
    .from('studies')
    .select('id, name, status, owner_id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!studyResult.data) {
    return (
      <section className={styles.page}>
        <FlashToast tone="error" title="Study not found" message="The requested study does not exist or is archived." />
        <Link href="/studies" className={styles.inlineButton}>
          Back to studies
        </Link>
      </section>
    );
  }

  const membersResult = await supabase
    .from('study_members')
    .select('study_id, user_id, role, added_at, created_at, deleted_at')
    .eq('study_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const memberIds = (membersResult.data ?? []).map((member) => member.user_id);
  const profilesResult =
    memberIds.length > 0
      ? await supabase.from('profiles').select('id, email, full_name').in('id', memberIds)
      : { data: [] as Array<{ id: string; email: string | null; full_name: string | null }> };

  const profileById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));

  return (
    <section className={styles.page}>
      {error ? <FlashToast tone="error" title="Study member action failed" message={error} /> : null}
      {notice ? <FlashToast tone="success" title="Study members updated" message={notice} /> : null}

      <header className={styles.header}>
        <h1 className={styles.title}>Study Access: {studyResult.data.name}</h1>
        <p className={styles.subtitle}>
          Manage study collaboration roles with auditable membership changes and role-bound permissions.
        </p>
        <div className={styles.actions}>
          <Link href="/studies" className={styles.inlineButton}>
            Back to studies
          </Link>
        </div>
      </header>

      <div className={styles.grid3}>
        <Card title="Status">
          <div className={styles.metric}>{studyResult.data.status}</div>
          <p className={styles.metricLabel}>Current study lifecycle state</p>
        </Card>
        <Card title="Owner">
          <div className={styles.metric}>{studyResult.data.owner_id}</div>
          <p className={styles.metricLabel}>Primary owner account id</p>
        </Card>
        <Card title="Active Members">
          <div className={styles.metric}>{membersResult.data?.length ?? 0}</div>
          <p className={styles.metricLabel}>Users with non-archived membership</p>
        </Card>
      </div>

      <Card title="Add Member" description="Invite by existing account email and assign a role.">
        <form action={addStudyMemberAction} className={styles.formGridSingle}>
          <input type="hidden" name="studyId" value={id} />
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="member-email">User Email</label>
              <input id="member-email" name="email" type="email" className={styles.input} placeholder="researcher@hospital.org" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="member-role">Role</label>
              <select id="member-role" name="role" className={styles.select} defaultValue="viewer">
                <option value="owner">owner</option>
                <option value="editor">editor</option>
                <option value="viewer">viewer</option>
              </select>
            </div>
          </div>
          <div className={styles.actions}>
            <Button type="submit">Add Member</Button>
          </div>
        </form>
      </Card>

      <Card title="Current Members">
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(membersResult.data ?? []).map((member) => {
                const profile = profileById.get(member.user_id);
                return (
                  <tr key={`${member.study_id}-${member.user_id}`}>
                    <td>{profile?.full_name || member.user_id}</td>
                    <td>{profile?.email || 'unknown-email'}</td>
                    <td>{member.role}</td>
                    <td>{formatDateTime(member.added_at || member.created_at)}</td>
                    <td>
                      <div className={styles.inlineActions}>
                        <form action={updateStudyMemberRoleAction} className={styles.inlineActions}>
                          <input type="hidden" name="studyId" value={id} />
                          <input type="hidden" name="userId" value={member.user_id} />
                          <select name="role" defaultValue={member.role} className={styles.inlineSelect}>
                            <option value="owner">owner</option>
                            <option value="editor">editor</option>
                            <option value="viewer">viewer</option>
                          </select>
                          <button type="submit" className={styles.inlineButton}>
                            Save
                          </button>
                        </form>
                        <form action={removeStudyMemberAction}>
                          <input type="hidden" name="studyId" value={id} />
                          <input type="hidden" name="userId" value={member.user_id} />
                          <button type="submit" className={`${styles.inlineButton} ${styles.inlineDanger}`}>
                            Remove
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(membersResult.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5}>No active members found for this study.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
