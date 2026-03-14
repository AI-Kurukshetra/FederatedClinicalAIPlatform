import { createAdminClient } from '@/lib/supabase/admin';
import { inviteMemberEmailTemplate, studySharedEmailTemplate } from '@/lib/email/auth-templates';
import { sendEmail } from '@/lib/email/mailer';

async function getEmailForUserId(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  return data.user.email;
}

export async function sendOrganizationInviteEmail(params: {
  invitedUserId: string;
  organizationName: string;
  invitedByName?: string;
  inviteLink: string;
}) {
  const email = await getEmailForUserId(params.invitedUserId);
  if (!email) return;

  const template = inviteMemberEmailTemplate({
    inviteLink: params.inviteLink,
    organizationName: params.organizationName,
    invitedByName: params.invitedByName,
  });

  await sendEmail({
    to: email,
    subject: `You're invited to ${params.organizationName}`,
    html: template.html,
    text: template.text,
  });
}

export async function sendOrganizationInviteEmailToAddress(params: {
  to: string;
  organizationName: string;
  invitedByName?: string;
  inviteLink: string;
}) {
  const template = inviteMemberEmailTemplate({
    inviteLink: params.inviteLink,
    organizationName: params.organizationName,
    invitedByName: params.invitedByName,
  });

  await sendEmail({
    to: params.to,
    subject: `You're invited to ${params.organizationName}`,
    html: template.html,
    text: template.text,
  });
}

export async function sendStudySharedEmail(params: {
  invitedUserId: string;
  studyName: string;
  organizationName: string;
  sharedByName?: string;
  studyLink: string;
}) {
  const email = await getEmailForUserId(params.invitedUserId);
  if (!email) return;

  const template = studySharedEmailTemplate({
    studyLink: params.studyLink,
    studyName: params.studyName,
    organizationName: params.organizationName,
    sharedByName: params.sharedByName,
  });

  await sendEmail({
    to: email,
    subject: `Study shared: ${params.studyName}`,
    html: template.html,
    text: template.text,
  });
}
