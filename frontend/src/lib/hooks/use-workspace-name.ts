'use client';

import { useAuth } from '@/contexts/auth-context';

/**
 * Returns a personalised workspace label: "Emmanuel's Workspace".
 * Falls back to "Your Workspace" while loading.
 */
export function useWorkspaceName(): string {
  const { user } = useAuth();
  if (!user) return 'Your Workspace';
  const firstName = user.name.split(' ')[0];
  return `${firstName}'s Workspace`;
}
