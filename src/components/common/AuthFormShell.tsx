import type { ReactNode } from 'react';
import styles from './AuthFormShell.module.css';

type AuthFormShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthFormShell({ eyebrow, title, description, children, footer }: AuthFormShellProps) {
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
        <div className={styles.form}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </section>
    </main>
  );
}
