'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface EmptyStateProps {
  illustration: ReactNode;
  eyebrow?: string;
  title: ReactNode;
  description: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Generic empty-state shell. The illustrations are inline SVGs supplied
 * by callers — keeping each one bespoke prevents the "stock empty state" feeling.
 */
export function EmptyState({
  illustration,
  eyebrow,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'mx-auto flex max-w-[520px] flex-col items-center text-center animate-fade-in-up',
        className,
      )}
    >
      <div className="mb-7">{illustration}</div>
      {eyebrow && (
        <div className="label-eyebrow mb-3 flex items-center gap-2.5">
          <span className="h-px w-6 bg-rule" />
          {eyebrow}
          <span className="h-px w-6 bg-rule" />
        </div>
      )}
      <h2 className="mb-3 font-serif text-[32px] font-light leading-[1.05] tracking-[-0.02em] text-paper">
        {title}
      </h2>
      <p className="mb-7 text-sm text-muted">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}

/* ─── Bespoke illustrations for each empty state ───────────────────── */

export function NoHistoryIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      {/* concentric clock-like rings */}
      <circle cx="60" cy="60" r="56" stroke="#262a28" strokeWidth="1" strokeDasharray="2 4" />
      <circle cx="60" cy="60" r="42" stroke="#262a28" strokeWidth="1" />
      <circle cx="60" cy="60" r="28" stroke="#323633" strokeWidth="1" />
      {/* hands */}
      <line x1="60" y1="60" x2="60" y2="32" stroke="#d3ff3a" strokeWidth="2" strokeLinecap="round" />
      <line x1="60" y1="60" x2="80" y2="60" stroke="#efece4" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="60" cy="60" r="3" fill="#d3ff3a" />
      {/* tick marks */}
      <line x1="60" y1="8" x2="60" y2="14" stroke="#5e625d" strokeWidth="1.5" />
      <line x1="60" y1="106" x2="60" y2="112" stroke="#5e625d" strokeWidth="1.5" />
      <line x1="8" y1="60" x2="14" y2="60" stroke="#5e625d" strokeWidth="1.5" />
      <line x1="106" y1="60" x2="112" y2="60" stroke="#5e625d" strokeWidth="1.5" />
    </svg>
  );
}

export function NoConnectionsIllustration() {
  return (
    <svg width="140" height="120" viewBox="0 0 140 120" fill="none" aria-hidden="true">
      {/* database cylinders, one disconnected */}
      <g>
        <ellipse cx="40" cy="38" rx="22" ry="6" stroke="#323633" strokeWidth="1.4" />
        <path d="M18 38v40a22 6 0 0 0 44 0V38" stroke="#323633" strokeWidth="1.4" />
        <path d="M18 58a22 6 0 0 0 44 0" stroke="#262a28" strokeWidth="1" />
      </g>
      {/* dotted line broken */}
      <path
        d="M62 60 L80 60 M88 60 L96 60"
        stroke="#5e625d"
        strokeWidth="1.4"
        strokeDasharray="3 4"
        strokeLinecap="round"
      />
      {/* destination cylinder, accent */}
      <g>
        <ellipse cx="118" cy="58" rx="18" ry="5" stroke="#d3ff3a" strokeWidth="1.4" />
        <path d="M100 58v32a18 5 0 0 0 36 0V58" stroke="#d3ff3a" strokeWidth="1.4" />
        <circle cx="118" cy="58" r="3" fill="#d3ff3a" />
      </g>
      {/* small plus sign hint */}
      <g transform="translate(82 42)">
        <circle r="9" fill="#0a0b0a" stroke="#d3ff3a" strokeWidth="1.4" />
        <path d="M-4 0h8M0 -4v8" stroke="#d3ff3a" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function NoSearchResultsIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <circle cx="50" cy="50" r="32" stroke="#323633" strokeWidth="1.4" />
      <line x1="74" y1="74" x2="98" y2="98" stroke="#323633" strokeWidth="2" strokeLinecap="round" />
      {/* empty inside the lens */}
      <circle cx="50" cy="50" r="22" stroke="#262a28" strokeWidth="1" strokeDasharray="2 3" />
      <line x1="40" y1="50" x2="60" y2="50" stroke="#5e625d" strokeWidth="1.5" strokeLinecap="round" />
      {/* sparkle */}
      <path d="M88 24 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" fill="#d3ff3a" />
    </svg>
  );
}

export function NoApiKeyIllustration() {
  return (
    <svg width="140" height="120" viewBox="0 0 140 120" fill="none" aria-hidden="true">
      {/* keyhole shield */}
      <path
        d="M70 12 L110 24 V62 C110 84 92 100 70 110 C48 100 30 84 30 62 V24 Z"
        stroke="#323633"
        strokeWidth="1.4"
        fill="#111312"
      />
      <circle cx="70" cy="56" r="9" stroke="#d3ff3a" strokeWidth="1.4" />
      <path d="M70 65 v14" stroke="#d3ff3a" strokeWidth="1.6" strokeLinecap="round" />
      {/* corner sparkles */}
      <path d="M22 30 l1 3 3 1 -3 1 -1 3 -1 -3 -3 -1 3 -1z" fill="#5e625d" />
      <path d="M118 84 l1 3 3 1 -3 1 -1 3 -1 -3 -3 -1 3 -1z" fill="#5e625d" />
    </svg>
  );
}

export function NoChatIllustration() {
  return (
    <svg width="140" height="120" viewBox="0 0 140 120" fill="none" aria-hidden="true">
      {/* layered chat bubbles */}
      <rect x="14" y="22" width="88" height="48" rx="10" stroke="#323633" strokeWidth="1.4" />
      <path d="M40 70 L34 84 L52 70 Z" stroke="#323633" strokeWidth="1.4" fill="#0a0b0a" />
      <line x1="28" y1="38" x2="80" y2="38" stroke="#5e625d" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="28" y1="50" x2="64" y2="50" stroke="#5e625d" strokeWidth="1.4" strokeLinecap="round" />

      <rect x="46" y="50" width="80" height="44" rx="10" stroke="#d3ff3a" strokeWidth="1.4" fill="#0a0b0a" />
      <path d="M104 94 L114 106 L96 94 Z" stroke="#d3ff3a" strokeWidth="1.4" fill="#0a0b0a" />
      <circle cx="62" cy="72" r="2" fill="#d3ff3a" />
      <circle cx="74" cy="72" r="2" fill="#d3ff3a" />
      <circle cx="86" cy="72" r="2" fill="#d3ff3a" />
    </svg>
  );
}
