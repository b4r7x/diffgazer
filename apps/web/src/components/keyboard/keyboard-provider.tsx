'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { matchesHotkey, isInputElement } from '@/lib/keyboard';

type Handler = () => void;
type HandlerMap = Map<string, Handler>;

interface KeyboardContextValue {
  activeScope: string | null;
  setScope: (scope: string | null) => void;
  register: (scope: string, hotkey: string, handler: Handler) => () => void;
}

export const KeyboardContext = createContext<KeyboardContextValue | null>(null);

export function KeyboardProvider({ children }: { children: React.ReactNode }) {
  const [activeScope, setScope] = useState<string | null>('global');
  const [handlers] = useState(() => new Map<string, HandlerMap>());

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isInputElement(event.target)) return;
      if (!activeScope) return;

      const scopeHandlers = handlers.get(activeScope);
      if (!scopeHandlers) return;

      for (const [hotkey, handler] of scopeHandlers) {
        if (matchesHotkey(event, hotkey)) {
          event.preventDefault();
          handler();
          break;
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeScope]);

  function register(scope: string, hotkey: string, handler: Handler) {
    if (!handlers.has(scope)) handlers.set(scope, new Map());
    handlers.get(scope)!.set(hotkey, handler);
    return () => handlers.get(scope)?.delete(hotkey);
  }

  return (
    <KeyboardContext.Provider value={{ activeScope, setScope, register }}>
      {children}
    </KeyboardContext.Provider>
  );
}

export function useKeyboard() {
  const ctx = useContext(KeyboardContext);
  if (!ctx) throw new Error('useKeyboard must be used within KeyboardProvider');
  return ctx;
}
