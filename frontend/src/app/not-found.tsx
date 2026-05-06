'use client';

import Link from 'next/link';
import { BrandMark } from '@/components/ui/brand';
import { ArrowRight } from '@/components/icons';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="text-center animate-fade-in-up">
        <BrandMark size={28} className="mx-auto mb-10 justify-center" />
        <div className="font-mono text-[140px] font-light leading-none tracking-[-0.06em] text-accent">
          404
        </div>
        <h1 className="mt-6 font-serif text-4xl font-light tracking-[-0.02em] text-paper">
          That table doesn&rsquo;t{' '}
          <em className="text-accent" style={{ fontStyle: 'italic' }}>
            exist.
          </em>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          You followed a stale link, or maybe a query someone shared a long time ago. Either way —
          let&rsquo;s get you back to safer ground.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 font-mono text-xs font-medium text-ink transition-all hover:bg-accent-2"
        >
          Back to home
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
