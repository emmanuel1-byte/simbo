'use client';

import { useEffect, useState } from 'react';
import { connectionsApi } from '@/lib/api';
import type { DbConnection } from '@/types';

interface UseConnectionsReturn {
  connections: DbConnection[];
  selected: DbConnection | null;
  setSelected: (c: DbConnection) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SELECTED_KEY = 'simbo.selected_connection';

export function useConnections(): UseConnectionsReturn {
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(SELECTED_KEY);
  });
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const list = await connectionsApi.list();
      setConnections(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const selected =
    connections.find((c) => c.id === selectedId) ??
    connections.find((c) => c.status === 'connected') ??
    null;

  function setSelected(c: DbConnection) {
    setSelectedId(c.id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SELECTED_KEY, c.id);
    }
  }

  return { connections, selected, setSelected, loading, refresh };
}
