'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { ArrowRight } from '@/components/icons';

export default function LandingPage() {
  const router = useRouter();
  const { status } = useAuth();
  const [demo, setDemo] = useState('');

  useEffect(() => {
    if (status === 'authenticated') router.replace(`/chat/new_${Date.now()}`);
  }, [status, router]);

  useEffect(() => {
    const sentences = [
      'How many active users signed up last week?',
      'Top 10 customers by revenue this quarter.',
      'Average response time on support tickets.',
      'Which cohort has the best 30-day retention?',
      "Show me orders that haven't shipped in 3 days.",
    ];
    let i = 0, c = 0;
    let phase: 'type' | 'wait' | 'erase' = 'type';
    const tick = () => {
      const s = sentences[i];
      if (phase === 'type') {
        c++;
        setDemo(s.slice(0, c));
        if (c >= s.length) phase = 'wait';
      } else if (phase === 'wait') {
        phase = 'erase';
        setTimeout(tick, 2200);
        return;
      } else {
        c--;
        setDemo(s.slice(0, c));
        if (c <= 0) { i = (i + 1) % sentences.length; phase = 'type'; }
      }
      setTimeout(tick, phase === 'type' ? 48 : 20);
    };
    const t = setTimeout(tick, 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-ink text-paper">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 border-b border-rule bg-ink/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1160px] items-center justify-between px-8">
          <span className="font-serif text-[17px] italic text-accent">simbo</span>
          <div className="flex items-center gap-5">
            <Link
              href="/signin"
              className="font-mono text-[11px] text-paper-2 transition-colors hover:text-paper"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="flex items-center gap-2 rounded-sm bg-accent px-4 py-2 font-mono text-[11px] font-medium text-paper-inv transition-colors hover:bg-accent-2"
            >
              Get started <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="border-b border-rule">
        <div className="mx-auto grid max-w-[1160px] grid-cols-1 items-center gap-14 px-8 py-20 lg:grid-cols-[1fr_1.1fr] lg:py-32">

          {/* Left: copy */}
          <div>
            <p className="label-eyebrow mb-8">Natural language · Any database</p>
            <h1 className="font-serif text-[60px] font-normal leading-[1.0] tracking-[-0.03em] text-paper md:text-[76px] lg:text-[88px]">
              Ask your<br />
              database<br />
              <em className="text-accent" style={{ fontStyle: 'italic' }}>
                anything
              </em>
              <span className="text-accent">.</span>
            </h1>
            <p className="mt-8 max-w-[400px] text-[15px] leading-[1.75] text-paper-2">
              Type a question in plain English. Get the answer, the SQL,
              and the full reasoning — in under a second.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/signup"
                className="flex items-center gap-2 rounded-sm bg-accent px-6 py-3 font-mono text-[12px] font-medium text-paper-inv transition-colors hover:bg-accent-2"
              >
                Get started <ArrowRight size={13} />
              </Link>
              <Link
                href="/signin"
                className="flex items-center gap-2 font-mono text-[11px] text-paper-2 transition-colors hover:text-paper"
              >
                Sign in <ArrowRight size={11} />
              </Link>
            </div>
          </div>

          {/* Right: product demo */}
          <div className="overflow-hidden rounded-xl border border-rule-2 bg-ink-3 shadow-overlay">
            {/* Toolbar */}
            <div className="flex items-center gap-2 border-b border-rule bg-ink-4 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-warn/50" />
              <span className="h-2.5 w-2.5 rounded-full bg-caution/50" />
              <span className="h-2.5 w-2.5 rounded-full bg-ok/50" />
              <span className="ml-4 font-mono text-[10px] text-paper-3">simbo · production-db</span>
            </div>

            {/* Query input */}
            <div className="flex items-start gap-3 px-5 py-5">
              <span className="mt-[3px] shrink-0 font-mono text-[15px] text-accent">›</span>
              <p className="flex-1 font-sans text-[15px] leading-[1.65] text-paper">
                {demo}
                <span className="animate-blink ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[2px] rounded-full bg-accent" />
              </p>
            </div>

            {/* Answer */}
            <div className="border-t border-rule px-5 py-4">
              <p className="font-serif text-[15px] leading-[1.6] text-paper">
                Found <span className="text-accent">2,847</span> active users who signed up last week,
                up <span className="text-accent">12.4%</span> from the previous week.
              </p>
            </div>

            {/* Result rows */}
            <div className="border-t border-rule px-5 py-4">
              <div className="label-eyebrow mb-3">Result preview</div>
              <div className="space-y-2">
                {[
                  { label: 'Total signups', val: '2,847' },
                  { label: 'vs. prior week', val: '+12.4%' },
                  { label: 'Peak day', val: 'Tuesday' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between font-mono text-[12px]">
                    <span className="text-paper-2">{row.label}</span>
                    <span className="text-accent">{row.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-rule bg-ink-4 px-5 py-3">
              <span className="font-mono text-[10px] text-paper-3">5 steps · 522ms</span>
              <span className="flex items-center gap-1 font-mono text-[10px] text-accent">
                View SQL <ArrowRight size={9} />
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* ── Three moments ───────────────────────────────────────────────── */}
      <section className="border-b border-rule bg-ink-2">
        <div className="mx-auto max-w-[1160px] px-8 py-20 lg:py-28">
          <p className="label-eyebrow mb-14 text-center">How it works</p>

          <div className="grid gap-0 divide-y divide-rule lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            {[
              {
                n: '01',
                title: 'You ask naturally',
                body: 'Type or speak your question. Simbo understands business language — "last quarter", "active users", "by region" — no SQL knowledge required.',
              },
              {
                n: '02',
                title: 'Simbo thinks transparently',
                body: 'Intent parsed. Schema validated. Safe, read-only SQL generated. Your database queried. Full execution timeline recorded. All under a second.',
              },
              {
                n: '03',
                title: 'You get answer + proof',
                body: 'A plain-English summary, the exact SQL, and a full execution timeline. Trust through total transparency — every step auditable.',
              },
            ].map((step, i) => (
              <div
                key={step.n}
                className={[
                  'py-10',
                  i > 0 ? 'lg:pl-12' : '',
                  i < 2 ? 'lg:pr-12' : '',
                ].join(' ')}
              >
                <div className="mb-6 font-mono text-[44px] font-light leading-none tracking-[-0.04em] text-accent/25">
                  {step.n}
                </div>
                <h3 className="mb-3 text-[17px] font-medium text-paper">{step.title}</h3>
                <p className="text-[14px] leading-[1.75] text-paper-2">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust ───────────────────────────────────────────────────────── */}
      <section className="border-b border-rule">
        <div className="mx-auto grid max-w-[1160px] grid-cols-1 items-center gap-16 px-8 py-20 lg:grid-cols-2 lg:py-28">

          {/* Text */}
          <div>
            <p className="label-eyebrow mb-6">Read-only by design</p>
            <h2 className="font-serif text-[40px] font-normal leading-[1.06] tracking-[-0.025em] text-paper md:text-[52px]">
              Your data stays<br />
              <em className="text-accent" style={{ fontStyle: 'italic' }}>safe. Always.</em>
            </h2>
            <div className="mt-8 space-y-4">
              {[
                'INSERT / UPDATE / DELETE blocked at the parser — not at runtime.',
                'AES-256 encryption at rest. TLS in transit. Results never stored.',
                'Every query logged. Full audit trail retained 90 days.',
                'Read-only credentials only. Simbo never needs write access.',
              ].map((line) => (
                <div key={line} className="flex items-start gap-3">
                  <span className="mt-[7px] h-[5px] w-[5px] flex-shrink-0 rounded-full bg-accent" />
                  <span className="text-[14px] leading-[1.65] text-paper-2">{line}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Code block */}
          <div className="overflow-hidden rounded-md border border-rule-2 bg-ink-3">
            <div className="border-b border-rule bg-ink-4 px-4 py-2.5">
              <span className="font-mono text-[10px] text-paper-3">guardrails.go</span>
            </div>
            <pre className="overflow-x-auto px-5 py-5 font-mono text-[12px] leading-[1.9]">
              <span className="sql-cm">{'// every query passes through this gate'}</span>{'\n'}
              <span className="sql-kw">if</span>{' strings.'}<span className="sql-fn">Contains</span>{'(sql, WRITE_KEYWORDS) {'}{'\n  '}
              <span className="sql-kw">return</span>{' '}<span className="sql-fn">ErrReadOnly</span>{'\n'}{'}'}
              {'\n\n'}
              <span className="sql-cm">{'// hard row-scan budget'}</span>{'\n'}
              <span className="sql-kw">if</span>{' scan > '}<span className="sql-num">1_000_000</span>{' {'}{'\n  '}
              <span className="sql-kw">return</span>{' '}<span className="sql-fn">ErrTooLarge</span>{'\n'}{'}'}
              {'\n\n'}
              <span className="sql-cm">{'// 30s hard timeout — always'}</span>{'\n'}
              {'ctx := context.'}<span className="sql-fn">WithTimeout</span>{'(ctx, '}<span className="sql-num">30</span>{'*time.Second)'}{'\n'}
              <span className="sql-kw">return</span>{' '}<span className="sql-fn">execute</span>{'(ctx, sql)'}
            </pre>
          </div>

        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section className="border-b border-rule bg-ink-2">
        <div className="mx-auto max-w-[1160px] px-8 py-24 lg:py-32">
          <h2 className="font-serif text-[52px] font-normal leading-[1.05] tracking-[-0.03em] text-paper md:text-[68px]">
            Your database is already<br />
            full of{' '}
            <em className="text-accent" style={{ fontStyle: 'italic' }}>answers.</em>
          </h2>
          <p className="mt-5 text-[16px] text-paper-2">Start asking them.</p>
          <div className="mt-10 flex flex-wrap items-center gap-5">
            <Link
              href="/signup"
              className="flex items-center gap-2 rounded-sm bg-accent px-6 py-3.5 font-mono text-[12px] font-medium text-paper-inv transition-colors hover:bg-accent-2"
            >
              Create your workspace <ArrowRight size={13} />
            </Link>
            <Link
              href="/signin"
              className="flex items-center gap-2 font-mono text-[11px] text-paper-2 transition-colors hover:text-paper"
            >
              Sign in <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-rule px-8 py-7">
        <div className="mx-auto flex max-w-[1160px] items-center justify-between">
          <span className="font-serif text-[15px] italic text-accent">simbo</span>
          <span className="font-mono text-[10px] text-paper-3">© {new Date().getFullYear()} Simbo</span>
        </div>
      </footer>

    </div>
  );
}
