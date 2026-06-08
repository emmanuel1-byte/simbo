'use client';

import { TrendingUp, User as UserIcon, Sparkles, Clock } from '@/components/icons';
import { useSuggestedPrompts } from '@/lib/hooks/use-suggested-prompts';
import type { PromptKind } from '@/lib/hooks/use-suggested-prompts';
import { cn } from '@/lib/utils/cn';

const iconMap: Record<PromptKind, React.FC<{ size?: number }>> = {
  growth:    TrendingUp,
  retention: UserIcon,
  revenue:   Sparkles,
  ops:       Clock,
};

interface SuggestedPromptsProps {
  onPick: (prompt: string) => void;
  connectionId?: string | null;
}

export function SuggestedPrompts({ onPick, connectionId }: SuggestedPromptsProps) {
  const { prompts, loading } = useSuggestedPrompts(connectionId);

  return (
    <div className="w-full max-w-[680px]">
      <div className="mb-4 flex items-center gap-2">
        <span className="label-eyebrow">Try asking</span>
        {connectionId && loading && (
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-paper-3">
            · loading from your database…
          </span>
        )}
        {connectionId && !loading && (
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-accent/60">
            · from your schema
          </span>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-[76px] animate-pulse rounded-md border border-rule bg-ink-3',
                  i % 2 === 1 && 'opacity-60',
                )}
              />
            ))
          : prompts.map((p) => {
              const Icon = iconMap[p.kind];
              return (
                <button
                  key={p.text}
                  type="button"
                  onClick={() => onPick(p.text)}
                  className="group flex items-start gap-3 rounded-md border border-rule-2 bg-ink-3 px-4 py-3.5 text-left transition-all duration-150 hover:border-accent/40 hover:bg-ink-4"
                >
                  <span className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-sm bg-accent/10 text-accent">
                    <Icon size={13} />
                  </span>
                  <span>
                    <small className="mb-1 block font-mono text-[9px] uppercase tracking-[0.14em] text-paper-3 group-hover:text-paper-2">
                      {p.kind}
                    </small>
                    <span className="text-[13px] leading-snug text-paper-2 group-hover:text-paper">
                      {p.text}
                    </span>
                  </span>
                </button>
              );
            })}
      </div>
    </div>
  );
}
