'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-ink lg:grid lg:grid-cols-2">

      {/* Left — brand panel */}
      <aside className="hidden flex-col justify-between border-r border-rule bg-ink-2 px-12 py-12 lg:flex">
        <Link href="/" className="font-serif text-[17px] italic text-accent">
          simbo
        </Link>

        <div>
          <h2 className="font-serif text-[48px] font-normal leading-[1.08] tracking-[-0.03em] text-paper">
            Your database<br />
            <em className="text-accent" style={{ fontStyle: 'italic' }}>speaks now.</em>
          </h2>
          <p className="mt-5 max-w-[360px] text-[14px] leading-[1.75] text-paper-2">
            Ask questions in plain English. Get answers in seconds.
            Full transparency into every query.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-6 border-t border-rule pt-8">
            {[
              { n: '30s',       l: 'to first answer' },
              { n: 'Read-only', l: 'by design' },
              { n: 'Zero SQL',  l: 'required' },
            ].map((s) => (
              <div key={s.l}>
                <div className="font-mono text-[18px] font-medium text-paper">{s.n}</div>
                <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-paper-3">
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="font-mono text-[10px] text-paper-3">
          © {new Date().getFullYear()} Simbo
        </div>
      </aside>

      {/* Right — form */}
      <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 py-12">
        <div className="mb-10 lg:hidden">
          <Link href="/" className="font-serif text-[17px] italic text-accent">
            simbo
          </Link>
        </div>
        <div className="w-full max-w-[400px]">
          {children}
        </div>
      </div>

    </div>
  );
}
