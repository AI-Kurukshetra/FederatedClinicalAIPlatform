import { NextResponse } from 'next/server';

export interface ApiMeta {
  requestId?: string;
  [key: string]: unknown;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export function ok<T>(data: T, meta?: ApiMeta, status = 200) {
  return NextResponse.json({ data, error: null, meta: meta ?? null }, { status });
}

export function fail(error: ApiErrorPayload, status = 400, meta?: ApiMeta) {
  return NextResponse.json({ data: null, error, meta: meta ?? null }, { status });
}
