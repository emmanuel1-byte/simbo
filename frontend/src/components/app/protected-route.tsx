'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { BrandMark } from '@/components/ui/brand';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Wraps app routes to redirect unauth'd users to /signin.
 * Renders a tasteful loading state while auth resolves.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status !== 'authenticated') {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <BrandMark size={42} />
          <div className="font-mono text-2xs uppercase tracking-[0.22em] text-muted">
            verifying session…
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
