'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  primary: [
    'bg-accent text-paper-inv border-accent font-medium',
    'hover:bg-accent-2 hover:border-accent-2',
    'active:scale-[0.98]',
    'disabled:hover:bg-accent disabled:hover:border-accent',
  ].join(' '),
  secondary: [
    'bg-transparent text-paper border-rule-2',
    'hover:border-rule-3 hover:bg-ink-4',
    'disabled:hover:border-rule-2 disabled:hover:bg-transparent',
  ].join(' '),
  ghost: [
    'bg-transparent text-paper-2 border-transparent',
    'hover:text-paper hover:bg-ink-4',
    'disabled:hover:text-paper-2 disabled:hover:bg-transparent',
  ].join(' '),
  danger: [
    'bg-transparent text-warn border-transparent',
    'hover:bg-warn/8 hover:border-warn/30',
    'disabled:hover:bg-transparent disabled:hover:border-transparent',
  ].join(' '),
};

const sizes: Record<Size, string> = {
  sm: 'h-7  gap-1.5 px-3    text-[11px]',
  md: 'h-9  gap-2   px-4    text-[12px]',
  lg: 'h-10 gap-2   px-5    text-[12px]',
};

const Spinner = () => (
  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
    <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, iconLeft, iconRight, fullWidth, className, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-sm border font-mono tracking-wide transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-1 focus-visible:ring-offset-ink',
        'disabled:cursor-not-allowed disabled:opacity-45',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? (
        <Spinner />
      ) : (
        iconLeft && <span className="shrink-0">{iconLeft}</span>
      )}
      <span>{children}</span>
      {!loading && iconRight && <span className="shrink-0">{iconRight}</span>}
    </button>
  );
});
