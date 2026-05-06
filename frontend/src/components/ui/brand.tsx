import { cn } from '@/lib/utils/cn';

interface BrandMarkProps {
  size?: number;
  withWordmark?: boolean;
  small?: string;
  className?: string;
}

/**
 * The Simbo wordmark + accent dot. Reused in headers, posters, logos.
 */
export function BrandMark({ size = 22, withWordmark = true, small, className }: BrandMarkProps) {
  return (
    <div
      className={cn('flex items-baseline gap-2.5 font-mono font-bold tracking-[-0.02em]', className)}
      style={{ fontSize: size }}
    >
      <span
        className="inline-block rounded-[3px] bg-accent"
        style={{
          width: size * 0.45,
          height: size * 0.45,
          boxShadow: `0 0 ${size}px #d3ff3a`,
          transform: 'translateY(-1px)',
        }}
      />
      {withWordmark && <span>simbo</span>}
      {small && (
        <span className="ml-3 border-l border-rule pl-3 font-sans text-[11px] font-light uppercase tracking-[0.18em] text-muted">
          {small}
        </span>
      )}
    </div>
  );
}
