'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AppTopbar } from '@/components/app/app-topbar';
import {
  User as UserIcon,
  Database,
  Key,
  Shield,
} from '@/components/icons';
import { cn } from '@/lib/utils/cn';

const groups = [
  {
    label: 'workspace',
    items: [{ href: '/settings/profile', icon: UserIcon, label: 'Profile' }],
  },
  {
    label: 'data',
    items: [
      { href: '/settings/connections', icon: Database, label: 'Connections' },
      { href: '/settings/api-key', icon: Key, label: 'API key' },
    ],
  },
  {
    label: 'trust',
    items: [{ href: '/settings/security', icon: Shield, label: 'Security' }],
  },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <AppTopbar crumb="workspace · acme analytics" title="Settings" />
      <div className="grid flex-1 grid-cols-[240px_1fr] overflow-hidden">
        <aside className="overflow-auto border-r border-rule bg-ink-2 py-7">
          {groups.map((g) => (
            <div key={g.label} className="mb-5 px-5">
              <div className="label-eyebrow mb-2.5">{g.label}</div>
              <div className="-mx-5">
                {g.items.map(({ href, icon: Icon, label }) => {
                  const active = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        'flex items-center gap-2.5 border-l-2 px-5 py-2 text-sm transition-colors',
                        active
                          ? 'border-l-accent bg-ink-3 text-paper'
                          : 'border-l-transparent text-muted hover:text-paper',
                      )}
                    >
                      <Icon size={14} />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        <main className="overflow-auto px-12 py-10">
          <div className="mx-auto max-w-[820px]">{children}</div>
        </main>
      </div>
    </>
  );
}
