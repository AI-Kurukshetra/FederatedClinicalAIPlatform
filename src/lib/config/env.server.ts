import 'server-only';
import { z } from 'zod';
import { clientEnv } from '@/lib/config/env.client';

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).optional(),
  OPENAI_ASK_AI_MODELS: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).optional(),
  GEMINI_ASK_AI_MODELS: z.string().min(1).optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z.enum(['true', 'false']).optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  SMTP_FROM: z.string().min(1).optional(),
});

const parsedServerEnv = serverEnvSchema.safeParse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_ASK_AI_MODELS: process.env.OPENAI_ASK_AI_MODELS,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  GEMINI_ASK_AI_MODELS: process.env.GEMINI_ASK_AI_MODELS,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM,
});

export const serverEnv = {
  ...clientEnv,
  SUPABASE_SERVICE_ROLE_KEY: parsedServerEnv.success ? parsedServerEnv.data.SUPABASE_SERVICE_ROLE_KEY : undefined,
  OPENAI_API_KEY: parsedServerEnv.success ? parsedServerEnv.data.OPENAI_API_KEY : undefined,
  OPENAI_MODEL: parsedServerEnv.success ? parsedServerEnv.data.OPENAI_MODEL : undefined,
  OPENAI_ASK_AI_MODELS: parsedServerEnv.success ? parsedServerEnv.data.OPENAI_ASK_AI_MODELS : undefined,
  GEMINI_API_KEY: parsedServerEnv.success ? parsedServerEnv.data.GEMINI_API_KEY : undefined,
  GEMINI_MODEL: parsedServerEnv.success ? parsedServerEnv.data.GEMINI_MODEL : undefined,
  GEMINI_ASK_AI_MODELS: parsedServerEnv.success ? parsedServerEnv.data.GEMINI_ASK_AI_MODELS : undefined,
  SMTP_HOST: parsedServerEnv.success ? parsedServerEnv.data.SMTP_HOST : undefined,
  SMTP_PORT: parsedServerEnv.success ? parsedServerEnv.data.SMTP_PORT : undefined,
  SMTP_SECURE: parsedServerEnv.success ? parsedServerEnv.data.SMTP_SECURE : undefined,
  SMTP_USER: parsedServerEnv.success ? parsedServerEnv.data.SMTP_USER : undefined,
  SMTP_PASS: parsedServerEnv.success ? parsedServerEnv.data.SMTP_PASS : undefined,
  SMTP_FROM: parsedServerEnv.success ? parsedServerEnv.data.SMTP_FROM : undefined,
};

export function requireServiceRoleKey() {
  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations.');
  }

  return serverEnv.SUPABASE_SERVICE_ROLE_KEY;
}

export function requireOpenAiKey() {
  if (!serverEnv.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for Ask AI operations.');
  }

  return serverEnv.OPENAI_API_KEY;
}

export function requireGeminiKey() {
  if (!serverEnv.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required for Gemini Ask AI operations.');
  }

  return serverEnv.GEMINI_API_KEY;
}

export function requireSmtpConfig() {
  const missing: string[] = [];

  if (!serverEnv.SMTP_HOST) missing.push('SMTP_HOST');
  if (!serverEnv.SMTP_PORT) missing.push('SMTP_PORT');
  if (!serverEnv.SMTP_SECURE) missing.push('SMTP_SECURE');
  if (!serverEnv.SMTP_USER) missing.push('SMTP_USER');
  if (!serverEnv.SMTP_PASS) missing.push('SMTP_PASS');
  if (!serverEnv.SMTP_FROM) missing.push('SMTP_FROM');

  if (missing.length) {
    throw new Error(`Missing SMTP configuration: ${missing.join(', ')}`);
  }

  return {
    host: serverEnv.SMTP_HOST,
    port: serverEnv.SMTP_PORT,
    secure: serverEnv.SMTP_SECURE === 'true',
    user: serverEnv.SMTP_USER,
    pass: serverEnv.SMTP_PASS,
    from: serverEnv.SMTP_FROM,
  };
}
