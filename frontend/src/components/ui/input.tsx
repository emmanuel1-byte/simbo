'use client';

import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { Eye, EyeOff } from '@/components/icons';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, iconLeft, iconRight, mono, className, ...props },
  ref,
) {
  return (
    <div
      className={cn(
        'group flex items-center gap-2.5 rounded-lg border bg-ink px-3.5 transition-colors',
        invalid ? 'border-warn/60' : 'border-rule focus-within:border-accent',
      )}
    >
      {iconLeft && <span className="text-muted shrink-0">{iconLeft}</span>}
      <input
        ref={ref}
        className={cn(
          'h-11 w-full bg-transparent text-paper placeholder:text-muted-2 focus:outline-none',
          mono ? 'font-mono text-xs tracking-wide' : 'font-sans text-sm',
          className,
        )}
        {...props}
      />
      {iconRight && <span className="text-muted shrink-0">{iconRight}</span>}
    </div>
  );
});

interface PasswordInputProps extends Omit<InputProps, 'type'> {}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(props, ref) {
    const [show, setShow] = useState(false);
    return (
      <Input
        ref={ref}
        {...props}
        type={show ? 'text' : 'password'}
        iconRight={
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="text-muted hover:text-paper transition-colors"
            tabIndex={-1}
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        }
      />
    );
  },
);

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}

/**
 * Wraps an input with a uppercase mono label and an error/hint slot.
 */
export function Field({ label, hint, error, children, htmlFor, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className="label-eyebrow">
          {label}
        </label>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
      {error && (
        <p className="font-mono text-2xs uppercase tracking-[0.12em] text-warn animate-fade-in">
          {error}
        </p>
      )}
    </div>
  );
}
