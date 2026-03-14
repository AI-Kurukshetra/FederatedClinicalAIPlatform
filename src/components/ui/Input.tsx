 'use client';

import type { InputHTMLAttributes } from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import styles from './Input.module.css';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  message?: string;
  hasError?: boolean;
};

export function Input({ label, id, className, message, hasError, ...props }: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordField = props.type === 'password';
  const resolvedType = isPasswordField ? (showPassword ? 'text' : 'password') : props.type;

  return (
    <label htmlFor={id} className={styles.field}>
      <span className={styles.label}>{label}</span>
      <span className={styles.control}>
        <input
          id={id}
          className={cn(styles.input, isPasswordField && styles.passwordInput, className)}
          {...props}
          type={resolvedType}
        />
        {isPasswordField ? (
          <button
            type="button"
            className={styles.toggle}
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M3 3l18 18" />
                <path d="M10.6 10.6A3 3 0 0012 15a3 3 0 002.4-4.8" />
                <path d="M9.9 5.2A10.4 10.4 0 0112 5c5 0 8.3 3.7 9.5 7-0.4 1.1-1.1 2.4-2.2 3.6" />
                <path d="M6.7 6.7C4.8 8 3.6 9.9 2.5 12c1.2 3.3 4.5 7 9.5 7 2 0 3.7-.6 5.2-1.5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M2 12s3.3-7 10-7 10 7 10 7-3.3 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        ) : null}
      </span>
      {message ? <p className={cn(styles.message, hasError && styles.error)}>{message}</p> : null}
    </label>
  );
}
