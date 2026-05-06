'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { BrandMark } from '@/components/ui/brand';
import { Pill } from '@/components/ui/pill';
import {
  ArrowRight,
  Check,
  Database,
  FileText,
  Lock,
  Mic,
  Shield,
  Sparkles,
  TrendingUp,
} from '@/components/icons';

export default function LandingPage() {
  const router = useRouter();
  const { status } = useAuth();
  const [demoText, setDemoText] = useState('');

  // Bounce already-signed-in users straight to the app
  useEffect(() => {
    if (status === 'authenticated') router.replace('/ask');
  }, [status, router]);

  // Cute typewriter for the hero demo
  useEffect(() => {
    const sentences = [
      'How many active users signed up last week?',
      'Top 10 customers by lifetime value this year.',
      'Average response time on tickets last month.',
      'Which cohort has the highest 30-day return rate?',
    ];
    let idx = 0;
    let charIdx = 0;
    let phase: 'typing' | 'pausing' | 'erasing' = 'typing';
    const tick = () => {
      const target = sentences[idx];
      if (phase === 'typing') {
        charIdx++;
        setDemoText(target.slice(0, charIdx));
        if (charIdx >= target.length) phase = 'pausing';
      } else if (phase === 'pausing') {
        phase = 'erasing';
        setTimeout(tick, 1800);
        return;
      } else {
        charIdx--;
        setDemoText(target.slice(0, charIdx));
        if (charIdx <= 0) {
          idx = (idx + 1) % sentences.length;
          phase = 'typing';
        }
      }
      setTimeout(tick, phase === 'typing' ? 55 : 30);
    };
    const t = setTimeout(tick, 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen">
      {/* ─── Header ───────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-rule/50 bg-ink/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
          <BrandMark size={20} />
          <nav className="hidden items-center gap-7 font-mono text-[12px] text-muted md:flex">
            <a href="#how" className="transition-colors hover:text-paper">
              How it works
            </a>
            <a href="#features" className="transition-colors hover:text-paper">
              Features
            </a>
            <a href="#trust" className="transition-colors hover:text-paper">
              Trust
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/signin"
              className="font-mono text-[12px] text-muted transition-colors hover:text-paper"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 font-mono text-[11px] font-medium text-ink transition-all hover:bg-accent-2"
            >
              Try free
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-rule">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-[700px] w-[1100px] -translate-x-1/2"
          style={{
            background:
              'radial-gradient(circle, rgba(211,255,58,0.12), transparent 60%)',
          }}
        />
        <div className="relative mx-auto max-w-[1100px] px-6 py-24 text-center md:py-32">
          <h1 className="m-0 font-serif text-5xl font-light leading-[1] tracking-[-0.03em] text-paper md:text-7xl lg:text-[88px]">
            Talk to your database{' '}
            <em className="text-accent" style={{ fontStyle: 'italic' }}>
              like a person.
            </em>
          </h1>
          <p className="mx-auto mt-7 max-w-[600px] text-[17px] leading-relaxed text-muted">
            Simbo turns plain English &mdash; or your voice &mdash; into safe, read-only SQL.
            Get answers from your database in seconds, with full transparency into how every
            query was built.
          </p>

          {/* Live demo input mock */}
          <div className="mx-auto mt-12 w-full max-w-[640px] rounded-[14px] border border-rule-2 bg-ink-2 p-1.5 text-left shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-2.5 px-4 py-3.5">
              <div className="flex overflow-hidden rounded-lg border border-rule">
                <span className="bg-ink-4 px-3 py-1.5 font-mono text-[10px] text-paper">
                  Text
                </span>
                <span className="px-3 py-1.5 font-mono text-[10px] text-muted">Voice</span>
              </div>
              <div className="min-h-[24px] flex-1 font-sans text-[15px] text-paper">
                {demoText}
                <span className="ml-0.5 inline-block h-[18px] w-[2px] translate-y-[2px] animate-pulse bg-accent" />
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-rule px-4 py-2.5">
              <div className="flex items-center gap-2 font-mono text-[10px] text-muted">
                <Database size={11} /> production · postgres
              </div>
              <span className="rounded-md bg-accent px-2.5 py-1 font-mono text-[10px] font-medium text-ink">
                Run query
              </span>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 font-mono text-[12px] font-medium text-ink transition-all hover:bg-accent-2"
            >
              Get started free
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/signin"
              className="inline-flex items-center gap-2 rounded-md border border-rule px-5 py-3 font-mono text-[12px] text-paper transition-colors hover:border-paper"
            >
              I already have an account
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <Pill variant="safe">read-only by design</Pill>
            <Pill variant="muted">BYO API key</Pill>
            <Pill variant="muted">SOC 2 in progress</Pill>
          </div>
        </div>
      </section>

      {/* ─── How it works ─────────────────────────────────── */}
      <section id="how" className="border-b border-rule px-6 py-24 md:py-32">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-16 max-w-2xl">
            <div className="label-eyebrow mb-3">how it works</div>
            <h2 className="m-0 font-serif text-4xl font-light leading-[1.05] tracking-[-0.02em] md:text-6xl">
              Three steps from question to{' '}
              <em className="text-accent" style={{ fontStyle: 'italic' }}>
                answer.
              </em>
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                n: '01',
                title: 'You ask, in plain English.',
                body: 'Type or speak your question. Simbo understands business language: "active users", "last quarter", "by region".',
                icon: Mic,
              },
              {
                n: '02',
                title: 'Simbo plans, validates, executes.',
                body: 'It interprets intent, generates SQL, validates against your schema, and runs the query — all in under a second.',
                icon: Sparkles,
              },
              {
                n: '03',
                title: 'You get the answer, plus the receipts.',
                body: 'A natural-language summary, the SQL it ran, the timeline of every step. Trust comes from being shown, not told.',
                icon: TrendingUp,
              },
            ].map((step) => (
              <div
                key={step.n}
                className="rounded-2xl border border-rule bg-ink-2 p-7 transition-colors hover:border-rule-2"
              >
                <div className="mb-5 flex items-center justify-between">
                  <span className="font-mono text-[44px] font-light leading-none tracking-[-0.04em] text-accent">
                    {step.n}
                  </span>
                  <step.icon size={20} />
                </div>
                <h3 className="m-0 mb-2 text-[18px] font-medium text-paper">
                  {step.title}
                </h3>
                <p className="m-0 text-[14px] leading-relaxed text-muted">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─────────────────────────────────────── */}
      <section id="features" className="border-b border-rule bg-ink-2 px-6 py-24 md:py-32">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-16 max-w-2xl">
            <div className="label-eyebrow mb-3">features</div>
            <h2 className="m-0 font-serif text-4xl font-light leading-[1.05] tracking-[-0.02em] md:text-6xl">
              Built for{' '}
              <em className="text-accent" style={{ fontStyle: 'italic' }}>
                analysts
              </em>{' '}
              and the people who never wanted to be one.
            </h2>
          </div>

          <div className="grid gap-px overflow-hidden rounded-2xl border border-rule bg-rule md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Mic,
                title: 'Voice + text input',
                body: 'Hold to speak, see live transcription, or type — switch anytime mid-thought.',
              },
              {
                icon: FileText,
                title: 'See the SQL',
                body: 'Engineers can audit. Non-technical users can ignore it. Both groups respect the option.',
              },
              {
                icon: Database,
                title: 'Postgres, MySQL, Snowflake, BigQuery',
                body: 'Connect with read-only credentials. Add as many as you want.',
              },
              {
                icon: Shield,
                title: 'Read-only guardrails',
                body: 'Writes are blocked at the parser. Heavy queries warned. Timeouts enforced.',
              },
              {
                icon: Sparkles,
                title: 'Bring your own AI',
                body: 'OpenAI, Anthropic, or Google. Your key, your data, your control.',
              },
              {
                icon: TrendingUp,
                title: 'Insights, not just rows',
                body: 'Anomalies, trends, and follow-up suggestions surface automatically next to results.',
              },
            ].map((f) => (
              <div key={f.title} className="bg-ink-2 p-7">
                <div className="mb-4 grid h-10 w-10 place-items-center rounded-md bg-ink-4 text-accent">
                  <f.icon size={18} />
                </div>
                <h3 className="m-0 mb-1.5 text-[15px] font-medium text-paper">{f.title}</h3>
                <p className="m-0 text-[13px] leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Trust ────────────────────────────────────────── */}
      <section id="trust" className="border-b border-rule px-6 py-24 md:py-32">
        <div className="mx-auto grid max-w-[1100px] gap-16 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="label-eyebrow mb-3">trust</div>
            <h2 className="m-0 font-serif text-4xl font-light leading-[1.05] tracking-[-0.02em] md:text-6xl">
              Read-only,{' '}
              <em className="text-accent" style={{ fontStyle: 'italic' }}>
                by design.
              </em>
            </h2>
            <p className="mt-6 text-[16px] leading-relaxed text-muted">
              We treat your data like ours: with paranoia. Simbo never writes, mutates, or
              deletes — and we'd rather refuse a query than guess at one.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                'INSERT / UPDATE / DELETE / DROP refused at the parser level.',
                'AES-256 encryption at rest. TLS in transit. PII redaction in logs (optional).',
                'Your AI provider key, your bill — we never proxy LLM costs.',
                'Audit log of every query and every config change, retained 90 days.',
              ].map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                    <Check size={11} />
                  </span>
                  <span className="text-[14px] text-paper">{line}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Code-ish illustration */}
         <div className="overflow-hidden rounded-2xl border border-rule bg-ink-2 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
  <div className="flex items-center gap-2 border-b border-rule bg-ink-3 px-4 py-3">
    <span className="h-2.5 w-2.5 rounded-full bg-warn/60" />
    <span className="h-2.5 w-2.5 rounded-full bg-accent/60" />
    <span className="h-2.5 w-2.5 rounded-full bg-rule-2" />
    <span className="ml-3 font-mono text-[11px] text-muted">guardrails.go</span>
  </div>

  <pre className="overflow-x-auto px-5 py-5 font-mono text-[12.5px] leading-[1.7] text-paper">
    <span className="sql-cm">// every query passes through this gate</span>
    {'\n'}
    <span className="sql-kw">if</span> strings.<span className="sql-fn">Contains</span>(sql, MUTATION_KEYWORDS) {'{'}
    {'\n  '}
    <span className="sql-kw">return</span> <span className="sql-fn">NewSafetyError</span>({'\n    '}
    <span className="sql-str">"Simbo is read-only. This query was refused."</span>,{'\n  '}
    )
    {'\n'}
    {'}'}

    {'\n\n'}
    <span className="sql-cm">// estimated row scan budget</span>
    {'\n'}
    <span className="sql-kw">if</span> estimate.ScanRows {'>'} <span className="sql-num">1_000_000</span> {'{'}
    {'\n  '}
    err := <span className="sql-fn">confirmWithUser</span>(estimate)
    {'\n  '}
    <span className="sql-kw">if</span> err != nil {'{'}
    {'\n    '}
    <span className="sql-kw">return</span> err
    {'\n  '}
    {'}'}
    {'\n'}
    {'}'}

    {'\n\n'}
    <span className="sql-cm">// timeouts at 30s · always</span>
    {'\n'}
    ctx, cancel := context.<span className="sql-fn">WithTimeout</span>(context.Background(), <span className="sql-num">30</span>*time.Second)
    {'\n'}
    <span className="sql-kw">defer</span> cancel()
    {'\n'}
    <span className="sql-kw">return</span> <span className="sql-fn">execute</span>(ctx, sql)
  </pre>
</div>
</div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────── */}
      <section className="border-b border-rule px-6 py-24 md:py-32">
        <div className="mx-auto max-w-[900px] text-center">
          <h2 className="m-0 font-serif text-4xl font-light leading-[1.05] tracking-[-0.02em] md:text-6xl">
            The fastest way to make a database{' '}
            <em className="text-accent" style={{ fontStyle: 'italic' }}>
              talk back.
            </em>
          </h2>
          <p className="mx-auto mt-6 max-w-[520px] text-[16px] text-muted">
            Free to try. Bring your own AI key. No credit card. No commitment.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-md bg-accent px-6 py-3.5 font-mono text-[12px] font-medium text-ink transition-all hover:bg-accent-2"
            >
              Get started free
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/signin"
              className="inline-flex items-center gap-2 rounded-md border border-rule px-6 py-3.5 font-mono text-[12px] text-paper transition-colors hover:border-paper"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────────── */}
      <footer className="px-6 py-12">
        <div className="mx-auto flex max-w-[1100px] flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <BrandMark size={18} />
            <p className="mt-2 max-w-sm font-mono text-[11px] text-muted">
              Built with care in Lagos. Ship with care everywhere.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 font-mono text-[11px] text-muted">
            <a href="#" className="transition-colors hover:text-paper">
              Privacy
            </a>
            <a href="#" className="transition-colors hover:text-paper">
              Terms
            </a>
            <a href="#" className="transition-colors hover:text-paper">
              Security
            </a>
            <a href="#" className="transition-colors hover:text-paper">
              Status
            </a>
            <span className="flex items-center gap-1.5">
              <Lock size={11} /> SOC 2 in progress
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
