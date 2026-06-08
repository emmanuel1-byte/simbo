'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils/cn';
import { X } from '@/components/icons';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Portal-mounted modal. Locks body scroll, traps focus in a basic way,
 * closes on Esc and backdrop click. Pass `footer` for action rows.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Esc to close + body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus the dialog so keyboard users start inside it
    requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof window === 'undefined') return null;

  const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 animate-fade-in"
      aria-modal="true"
      role="dialog"
    >
      <div
        className="absolute inset-0 bg-ink/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full overflow-hidden rounded-2xl border border-rule bg-ink-2 shadow-[0_30px_80px_rgba(0,0,0,0.6)] focus:outline-none animate-fade-in-up',
          sizes[size],
        )}
      >
        {(title || description) && (
          <header className="flex items-start justify-between gap-4 border-b border-rule px-7 py-5">
            <div>
              {title && (
                <h3 className="m-0 font-serif text-2xl font-light leading-tight tracking-[-0.01em] text-paper">
                  {title}
                </h3>
              )}
              {description && (
                <p className="mt-1.5 text-[13px] text-muted">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg border border-rule text-muted transition-colors hover:border-paper hover:text-paper"
            >
              <X size={14} />
            </button>
          </header>
        )}
        <div className="px-7 py-6">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-3 border-t border-rule bg-ink-3 px-7 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ── Confirmation dialog (destructive actions) ───────────────────── */

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: ReactNode;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  loading,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-transparent px-4 py-2 font-mono text-xs text-muted transition-colors hover:text-paper disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-mono text-xs font-medium transition-colors disabled:opacity-60',
              destructive
                ? 'border-warn/40 bg-warn/10 text-warn hover:bg-warn/15'
                : 'border-accent bg-accent text-ink hover:bg-accent-2',
            )}
          >
            {loading && (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="m-0 text-[14px] leading-relaxed text-muted">{description}</p>
    </Modal>
  );
}
