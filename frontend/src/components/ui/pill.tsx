import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface PillProps {
  variant?: 'default' | 'safe' | 'warn' | 'muted';
  children: ReactNode;
  className?: string;
}

export function Pill({ variant = 'default', children, className }: PillProps) {
  const variants = {
    default: 'border-rule text-paper',
    safe: 'border-accent/40 bg-accent/5 text-accent',
    warn: 'border-warn/40 bg-warn/5 text-warn',
    muted: 'border-rule text-muted',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-2xs uppercase',
        variants[variant],
        className,
      )}
      style={{ letterSpacing: '0.12em' }}
    >
      {variant === 'safe' && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-accent"
          style={{ boxShadow: '0 0 6px #d3ff3a' }}
        />
      )}
      {variant === 'warn' && <span className="h-1.5 w-1.5 rounded-full bg-warn" />}
      {children}
    </span>
  );
}
