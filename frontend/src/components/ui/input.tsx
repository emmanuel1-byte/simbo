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
        'flex items-center gap-2.5 rounded-sm border bg-ink-3 px-3 py-0 transition-all duration-150',
        invalid
          ? 'border-warn shadow-[0_0_0_1px_rgba(192,80,74,0.25)]'
          : 'border-rule-2 hover:border-rule-3 focus-within:border-accent focus-within:shadow-[0_0_0_2px_rgba(212,130,10,0.20)]',
      )}
    >
      {iconLeft && <span className="shrink-0 text-paper-3">{iconLeft}</span>}
      <input
        ref={ref}
        className={cn(
          'h-10 w-full bg-transparent text-paper placeholder:text-paper-3 focus:outline-none',
          mono ? 'font-mono text-[12px] tracking-wide' : 'font-sans text-[14px]',
          className,
        )}
        {...props}
      />
      {iconRight && <span className="shrink-0 text-paper-3">{iconRight}</span>}
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
            className="text-paper-3 transition-colors hover:text-paper"
            tabIndex={-1}
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
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

export function Field({ label, hint, error, children, htmlFor, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className="label-eyebrow">
          {label}
        </label>
        {hint && <span className="font-mono text-[10px] text-paper-2">{hint}</span>}
      </div>
      {children}
      {error && (
        <p className="animate-fade-in font-mono text-[10px] uppercase tracking-[0.12em] text-warn">
          {error}
        </p>
      )}
    </div>
  );
}
