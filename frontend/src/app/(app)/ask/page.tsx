'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// /ask is no longer the home screen — send directly to a fresh chat.
export default function AskRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/chat/new_${Date.now()}`);
  }, [router]);
  return null;
}
