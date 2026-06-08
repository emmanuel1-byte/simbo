import type { ReactNode } from 'react';
import { AccountMenu } from '@/components/app/account-menu';
import { cn } from '@/lib/utils/cn';

interface AppTopbarProps {
  crumb?: ReactNode;
  title?: string;
  right?: ReactNode;
  className?: string;
}

export function AppTopbar({ crumb, title, right, className }: AppTopbarProps) {
  return (
    <div
      className={cn(
        'flex h-11 flex-shrink-0 items-center gap-3 border-b border-rule bg-ink-2 px-5',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 font-mono text-[11px] text-paper-2">
        {crumb}
        {title && (
          <>
            <span className="select-none text-paper-3 opacity-50">/</span>
            <span className="truncate text-paper/70">{title}</span>
          </>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-3">
        {right}
        <AccountMenu />
      </div>
    </div>
  );
}
