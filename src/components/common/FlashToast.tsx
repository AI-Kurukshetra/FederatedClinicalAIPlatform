'use client';

import { useEffect, useState } from 'react';
import styles from './FlashToast.module.css';

type FlashTone = 'success' | 'error' | 'info';

type FlashToastProps = {
  tone: FlashTone;
  message: string;
  title?: string;
  durationMs?: number;
};

export function FlashToast({ tone, message, title, durationMs = 8000 }: FlashToastProps) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    if (!message) return;
    const timeoutId = window.setTimeout(() => setVisible(false), durationMs);
    return () => window.clearTimeout(timeoutId);
  }, [message, durationMs]);

  if (!visible || !message) return null;

  return (
    <aside className={`${styles.toast} ${styles[tone]}`} role="status" aria-live="polite">
      <div className={styles.row}>
        <span className={styles.title}>{title ?? (tone === 'error' ? 'Action failed' : 'Notification')}</span>
        <button type="button" onClick={() => setVisible(false)} className={styles.close} aria-label="Dismiss message">
          ×
        </button>
      </div>
      <div className={styles.message}>{message}</div>
    </aside>
  );
}
