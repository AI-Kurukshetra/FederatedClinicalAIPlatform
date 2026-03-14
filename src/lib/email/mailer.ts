import 'server-only';
import nodemailer from 'nodemailer';
import { requireSmtpConfig } from '@/lib/config/env.server';

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const smtp = requireSmtpConfig();
  cachedTransporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  return cachedTransporter;
}

type MailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail(payload: MailPayload) {
  const smtp = requireSmtpConfig();
  const transporter = getTransporter();
  await transporter.sendMail({
    from: smtp.from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });
}
