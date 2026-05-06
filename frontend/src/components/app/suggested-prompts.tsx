'use client';

import { TrendingUp, User as UserIcon, Sparkles, Clock } from '@/components/icons';
import { suggestedPrompts } from '@/lib/data/mocks';

const iconMap = {
  growth: TrendingUp,
  retention: UserIcon,
  revenue: Sparkles,
  ops: Clock,
} as const;

interface SuggestedPromptsProps {
  onPick: (prompt: string) => void;
}

export function SuggestedPrompts({ onPick }: SuggestedPromptsProps) {
  return (
    <div className="w-full max-w-[720px] text-left">
      <div className="label-eyebrow mb-3.5">Try one of these</div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {suggestedPrompts.map((p) => {
          const Icon = iconMap[p.kind];
          return (
            <button
              key={p.text}
              type="button"
              onClick={() => onPick(p.text)}
              className="group flex items-start gap-3 rounded-xl border border-rule bg-ink-2 px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-accent"
            >
              <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md bg-ink-4 text-accent">
                <Icon size={14} />
              </span>
              <span className="text-sm text-paper">
                <small className="mb-1 block font-mono text-2xs uppercase tracking-[0.1em] text-muted">
                  {p.kind}
                </small>
                {p.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
