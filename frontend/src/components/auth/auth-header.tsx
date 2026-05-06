import type { ReactNode } from 'react';

interface AuthHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  lead: string;
}

export function AuthHeader({ eyebrow, title, lead }: AuthHeaderProps) {
  return (
    <div className="mb-8">
      {eyebrow && (
        <div className="label-eyebrow mb-3 flex items-center gap-2.5">
          <span className="h-px w-6 bg-rule" />
          {eyebrow}
        </div>
      )}
      <h1 className="mb-2 font-serif text-[38px] font-light leading-[1.05] tracking-[-0.02em] text-paper">
        {title}
      </h1>
      <p className="text-sm text-muted">{lead}</p>
    </div>
  );
}
