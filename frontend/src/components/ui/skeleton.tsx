import { cn } from '@/lib/utils/cn';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-shimmer rounded bg-gradient-to-r from-ink-3 via-ink-4 to-ink-3 bg-[length:200%_100%]',
        className,
      )}
    />
  );
}
