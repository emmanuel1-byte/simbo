'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn('rounded-md border border-rule-2 bg-ink-3 p-6', className)}>
      {children}
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export function Toggle({ checked, onChange, disabled, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 rounded-full border transition-all duration-200',
        checked ? 'border-accent bg-accent' : 'border-rule-2 bg-ink-4',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-paper-inv transition-all duration-200',
          checked ? 'left-[18px]' : 'left-0.5 bg-paper-2',
        )}
      />
    </button>
  );
}

export function Divider({ label, className }: { label?: string; className?: string }) {
  if (!label) return <hr className={cn('border-t border-rule', className)} />;
  return (
    <div className={cn('flex items-center gap-3.5', className)}>
      <span className="h-px flex-1 bg-rule" />
      <span className="font-mono text-2xs uppercase tracking-[0.18em] text-paper-3">{label}</span>
      <span className="h-px flex-1 bg-rule" />
    </div>
  );
}
