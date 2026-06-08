'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { ChatMessage, ExecutionStep } from '@/types';

interface InspectorState {
  message: ChatMessage | null;
  liveSteps: ExecutionStep[];
}

interface InspectorContextValue extends InspectorState {
  setInspector: (message: ChatMessage | null, liveSteps: ExecutionStep[]) => void;
  clearInspector: () => void;
}

const InspectorContext = createContext<InspectorContextValue>({
  message: null,
  liveSteps: [],
  setInspector: () => {},
  clearInspector: () => {},
});

export function InspectorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<InspectorState>({ message: null, liveSteps: [] });

  const setInspector = useCallback((message: ChatMessage | null, liveSteps: ExecutionStep[]) => {
    setState({ message, liveSteps });
  }, []);

  const clearInspector = useCallback(() => {
    setState({ message: null, liveSteps: [] });
  }, []);

  return (
    <InspectorContext.Provider value={{ ...state, setInspector, clearInspector }}>
      {children}
    </InspectorContext.Provider>
  );
}

export function useInspector() {
  return useContext(InspectorContext);
}
