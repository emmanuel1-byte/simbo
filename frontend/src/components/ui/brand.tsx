import { cn } from '@/lib/utils/cn';

interface BrandMarkProps {
  size?: number;
  withWordmark?: boolean;
  small?: string;
  className?: string;
}

export function BrandMark({ size = 22, withWordmark = true, small, className }: BrandMarkProps) {
  return (
    <div
      className={cn('flex items-baseline gap-2 font-mono font-bold tracking-tight', className)}
      style={{ fontSize: size }}
    >
      <span
        className="inline-block bg-accent"
        style={{ width: size * 0.45, height: size * 0.45, transform: 'translateY(-1px)' }}
      />
      {withWordmark && <span className="text-paper">simbo</span>}
      {small && (
        <span className="ml-2 border-l border-rule pl-2 font-sans text-[11px] font-light uppercase tracking-[0.18em] text-muted">
          {small}
        </span>
      )}
    </div>
  );
}
