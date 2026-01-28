'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { matchesHotkey, isInputElement } from '@/lib/keyboard';

type Handler = () => void;
type HandlerMap = Map<string, Handler>;

interface KeyboardContextValue {
  activeScope: string | null;
  pushScope: (scope: string) => () => void;
  register: (scope: string, hotkey: string, handler: Handler) => () => void;
}

export const KeyboardContext = createContext<KeyboardContextValue | null>(null);

export function KeyboardProvider({ children }: { children: React.ReactNode }) {
  const [scopeStack, setScopeStack] = useState<string[]>(['global']);
  const [handlers] = useState(() => new Map<string, HandlerMap>());

  const activeScope = scopeStack[scopeStack.length - 1] ?? null;

  const pushScope = (scope: string) => {
    setScopeStack(prev => [...prev, scope]);
    return () => setScopeStack(prev => {
      const idx = prev.lastIndexOf(scope);
      return idx >= 0 ? [...prev.slice(0, idx), ...prev.slice(idx + 1)] : prev;
    });
  };

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
  }, [activeScope, handlers]);

  const register = (scope: string, hotkey: string, handler: Handler) => {
    if (!handlers.has(scope)) handlers.set(scope, new Map());
    handlers.get(scope)!.set(hotkey, handler);
    return () => handlers.get(scope)?.delete(hotkey);
  };

  return (
    <KeyboardContext.Provider value={{ activeScope, pushScope, register }}>
      {children}
    </KeyboardContext.Provider>
  );
}

export function useKeyboard() {
  const ctx = useContext(KeyboardContext);
  if (!ctx) throw new Error('useKeyboard must be used within KeyboardProvider');
  return ctx;
}
