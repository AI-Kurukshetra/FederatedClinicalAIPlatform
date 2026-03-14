import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import styles from './Card.module.css';

type CardProps = {
  title?: string;
  description?: string;
  children?: ReactNode;
  className?: string;
};

export function Card({ title, description, children, className }: CardProps) {
  return (
    <section className={cn(styles.card, className)}>
      {title ? <h3 className={styles.title}>{title}</h3> : null}
      {description ? <p className={styles.description}>{description}</p> : null}
      {children ? <div className={styles.body}>{children}</div> : null}
    </section>
  );
}
