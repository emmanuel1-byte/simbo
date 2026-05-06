'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/ui/brand';

interface AuthLayoutProps {
  children: ReactNode;
}

const stats = [
  { b: '30s', s: 'to first answer' },
  { b: 'Read-only', s: 'by design' },
  { b: 'BYO key', s: 'your AI, your data' },
];

/**
 * Two-column auth chrome — poster left, form right.
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Left poster — desktop only */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-rule bg-ink-2 p-12 lg:flex">
        <div
          className="pointer-events-none absolute -right-48 -top-32 h-[600px] w-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(211,255,58,0.12), transparent 60%)',
          }}
        />
        <Link href="/" className="relative z-10">
          <BrandMark size={30} />
        </Link>

        <blockquote className="relative z-10 max-w-[480px] font-serif text-[42px] font-light leading-[1.1] tracking-[-0.02em]">
          The fastest way to make a database talk back.{' '}
          <em className="not-italic text-accent" style={{ fontStyle: 'italic' }}>
            Without writing a single line of SQL.
          </em>
        </blockquote>

        <div className="relative z-10 flex gap-9 border-t border-rule pt-6 font-mono">
          {stats.map((s) => (
            <div key={s.b}>
              <b className="block text-[22px] font-medium tracking-[-0.02em] text-paper">{s.b}</b>
              <small className="text-2xs uppercase tracking-[0.18em] text-muted">{s.s}</small>
            </div>
          ))}
        </div>
      </aside>

      {/* Right form column */}
      <main className="relative flex min-h-screen flex-col p-6 sm:p-12 lg:p-14">
        {/* Mobile brand + back to home */}
        <div className="mb-8 flex items-center justify-between lg:hidden">
          <Link href="/">
            <BrandMark size={22} />
          </Link>
        </div>
        <div className="m-auto w-full max-w-[460px]">{children}</div>
      </main>
    </div>
  );
}
