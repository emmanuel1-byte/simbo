import type { ReactNode } from 'react';
import { Pill } from '@/components/ui/pill';
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
        'flex h-[58px] flex-shrink-0 items-center gap-5 border-b border-rule bg-ink-2 px-6',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3 font-mono text-[11px] text-muted">
        {crumb}
        {title && (
          <>
            <span className="text-rule-2">/</span>
            <b className="truncate font-medium text-paper">{title}</b>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        <Pill variant="safe" className="hidden md:inline-flex">SAFE MODE</Pill>
        {right}
        <AccountMenu />
      </div>
    </div>
  );
}
