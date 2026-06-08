'use client';

import { AppTopbar } from '@/components/app/app-topbar';
import { useWorkspaceName } from '@/lib/hooks/use-workspace-name';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const workspaceName = useWorkspaceName();
  return (
    <>
      <AppTopbar crumb={workspaceName} title="Settings" />
      <main className="flex-1 overflow-auto px-12 py-10">
        <div className="mx-auto max-w-[820px]">{children}</div>
      </main>
    </>
  );
}
