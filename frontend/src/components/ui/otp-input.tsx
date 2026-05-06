'use client';

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils/cn';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Six-cell OTP input. Handles keyboard nav, paste, backspace flow.
 */
export function OtpInput({
  length = 6,
  value,
  onChange,
  invalid,
  disabled,
  autoFocus,
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  function setDigit(idx: number, char: string) {
    const next = digits.slice();
    next[idx] = char;
    onChange(next.join('').slice(0, length));
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>, idx: number) {
    const key = e.key;
    if (key === 'Backspace') {
      e.preventDefault();
      if (digits[idx]) {
        setDigit(idx, '');
      } else if (idx > 0) {
        refs.current[idx - 1]?.focus();
        setDigit(idx - 1, '');
      }
      return;
    }
    if (key === 'ArrowLeft' && idx > 0) refs.current[idx - 1]?.focus();
    if (key === 'ArrowRight' && idx < length - 1) refs.current[idx + 1]?.focus();
    if (/^\d$/.test(key)) {
      e.preventDefault();
      setDigit(idx, key);
      if (idx < length - 1) refs.current[idx + 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!text) return;
    e.preventDefault();
    onChange(text);
    refs.current[Math.min(text.length, length - 1)]?.focus();
  }

  return (
    <div className="flex gap-2">
      {digits.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => {
            refs.current[idx] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 1);
            if (v) {
              setDigit(idx, v);
              if (idx < length - 1) refs.current[idx + 1]?.focus();
            }
          }}
          onKeyDown={(e) => handleKey(e, idx)}
          onPaste={handlePaste}
          onFocus={() => setActiveIdx(idx)}
          aria-label={`Digit ${idx + 1}`}
          className={cn(
            'h-14 w-12 rounded-lg border bg-ink text-center font-mono text-xl text-paper transition-all focus:outline-none',
            invalid
              ? 'border-warn/60'
              : 'border-rule focus:border-accent focus:shadow-[0_0_0_3px_rgba(211,255,58,0.1)]',
            digit && !invalid && 'border-accent/60',
            activeIdx === idx && !digit && 'border-rule-2',
          )}
        />
      ))}
    </div>
  );
}
