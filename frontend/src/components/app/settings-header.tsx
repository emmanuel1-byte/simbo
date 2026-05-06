import type { ReactNode } from 'react';

interface SettingsHeaderProps {
  title: ReactNode;
  lead: string;
}

export function SettingsHeader({ title, lead }: SettingsHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="m-0 mb-1.5 font-serif text-[32px] font-light leading-[1.05] tracking-[-0.02em] text-paper">
        {title}
      </h1>
      <p className="m-0 text-muted">{lead}</p>
    </div>
  );
}
