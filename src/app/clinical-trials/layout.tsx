import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';

export default function ClinicalTrialsLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
