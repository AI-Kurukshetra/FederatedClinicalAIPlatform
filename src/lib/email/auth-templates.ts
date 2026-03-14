type TransactionalTemplateInput = {
  preheader: string;
  title: string;
  message: string;
  ctaLabel: string;
  ctaLink: string;
  secondaryMessage?: string;
};

type EmailContent = {
  html: string;
  text: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildTransactionalEmail({
  preheader,
  title,
  message,
  ctaLabel,
  ctaLink,
  secondaryMessage,
}: TransactionalTemplateInput): EmailContent {
  const safePreheader = escapeHtml(preheader);
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeCtaLabel = escapeHtml(ctaLabel);
  const safeLink = escapeHtml(ctaLink);
  const safeSecondary = secondaryMessage ? escapeHtml(secondaryMessage) : '';

  const html = `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${safePreheader}
    </div>
    <div style="font-family:Arial,'Segoe UI',sans-serif;background:#f3f7fb;padding:24px;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #cfdaea;border-radius:14px;overflow:hidden;">
        <div style="padding:18px 24px;background:#0f2746;color:#e9f2ff;">
          <p style="margin:0;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;">Nference Research OS</p>
          <p style="margin:6px 0 0;font-size:12px;color:#c8d9ef;">Federated Clinical AI Platform for Real-World Evidence</p>
        </div>
        <div style="padding:24px;">
          <h2 style="margin:0 0 12px;color:#0f223d;font-size:24px;line-height:1.2;">${safeTitle}</h2>
          <p style="margin:0 0 16px;color:#304762;line-height:1.6;font-size:14px;">${safeMessage}</p>
          <a href="${safeLink}" style="display:inline-block;background:#0c63ca;color:#ffffff;text-decoration:none;padding:11px 16px;border-radius:999px;font-weight:700;font-size:14px;">
            ${safeCtaLabel}
          </a>
          ${safeSecondary ? `<p style="margin:16px 0 0;color:#46607d;line-height:1.6;font-size:13px;">${safeSecondary}</p>` : ''}
          <p style="margin:18px 0 0;color:#607a97;font-size:12px;line-height:1.5;">
            If the button does not work, copy and paste this link into your browser:<br />
            <span style="word-break:break-all;">${safeLink}</span>
          </p>
        </div>
        <div style="padding:14px 24px;background:#f7fafd;border-top:1px solid #e1e9f4;color:#607a97;font-size:12px;">
          This is an automated message from Nference Research OS. Please do not reply to this email.
        </div>
      </div>
    </div>
  `;

  const text = [
    'Nference Research OS',
    'Federated Clinical AI Platform for Real-World Evidence',
    '',
    title,
    message,
    secondaryMessage ?? '',
    '',
    `${ctaLabel}: ${ctaLink}`,
    '',
    'If this was not initiated by you, you can ignore this email.',
  ]
    .filter(Boolean)
    .join('\n');

  return { html, text };
}

export function verificationEmailTemplate(verificationLink: string): EmailContent {
  return buildTransactionalEmail({
    preheader: 'Verify your email to activate your account',
    title: 'Verify your email address',
    message: 'Please verify your account to securely access your clinical research workspace.',
    ctaLabel: 'Verify Email',
    ctaLink: verificationLink,
    secondaryMessage: 'This verification link will expire for security reasons.',
  });
}

export function resetPasswordEmailTemplate(resetLink: string): EmailContent {
  return buildTransactionalEmail({
    preheader: 'Reset your account password',
    title: 'Reset your password',
    message: 'A password reset was requested for your account. Use the secure link below to set a new password.',
    ctaLabel: 'Reset Password',
    ctaLink: resetLink,
    secondaryMessage: 'If you did not request this, you can ignore this message.',
  });
}

export function inviteMemberEmailTemplate(params: {
  inviteLink: string;
  organizationName: string;
  invitedByName?: string;
}): EmailContent {
  const actor = params.invitedByName ? `${params.invitedByName} invited you` : 'You were invited';
  return buildTransactionalEmail({
    preheader: `Invitation to join ${params.organizationName}`,
    title: `Join ${params.organizationName}`,
    message: `${actor} to collaborate in the Nference Research OS workspace for federated clinical research.`,
    ctaLabel: 'Accept Invitation',
    ctaLink: params.inviteLink,
    secondaryMessage: 'Accept this invite to access studies, cohorts, and organization resources.',
  });
}

export function studySharedEmailTemplate(params: {
  studyLink: string;
  studyName: string;
  organizationName: string;
  sharedByName?: string;
}): EmailContent {
  const actor = params.sharedByName ? `${params.sharedByName} shared` : 'A team member shared';
  return buildTransactionalEmail({
    preheader: `Study access granted: ${params.studyName}`,
    title: 'Study access granted',
    message: `${actor} the study "${params.studyName}" with you in ${params.organizationName}.`,
    ctaLabel: 'Open Study',
    ctaLink: params.studyLink,
    secondaryMessage: 'Review study settings, members, and cohort definitions from your workspace.',
  });
}
