"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isInputElement, matchesHotkey } from "@/app/providers/keyboard-utils";

type Handler = () => void;

interface HandlerOptions {
  allowInInput?: boolean;
}

interface HandlerEntry {
  handler: Handler;
  options?: HandlerOptions;
}

type HandlerMap = Map<string, HandlerEntry>;

interface KeyboardContextValue {
  activeScope: string | null;
  pushScope: (scope: string) => () => void;
  register: (scope: string, hotkey: string, handler: Handler, options?: HandlerOptions) => () => void;
}

export const KeyboardContext = createContext<KeyboardContextValue | null>(null);

export function KeyboardProvider({ children }: { children: ReactNode }) {
  const [scopeStack, setScopeStack] = useState<string[]>(["global"]);
  const [handlers] = useState(() => new Map<string, HandlerMap>());

  const activeScope = scopeStack[scopeStack.length - 1] ?? null;

  const pushScope = useCallback((scope: string) => {
    setScopeStack((prev) => [...prev, scope]);
    return () =>
      setScopeStack((prev) => {
        const idx = prev.lastIndexOf(scope);
        return idx >= 0 ? [...prev.slice(0, idx), ...prev.slice(idx + 1)] : prev;
      });
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!activeScope) return;

      const scopeHandlers = handlers.get(activeScope);
      if (!scopeHandlers) return;

      const isInput = isInputElement(event.target);

      for (const [hotkey, entry] of scopeHandlers) {
        if (isInput && !entry.options?.allowInInput) continue;
        if (matchesHotkey(event, hotkey)) {
          event.preventDefault();
          entry.handler();
          break;
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeScope, handlers]);

  const register = useCallback(
    (scope: string, hotkey: string, handler: Handler, options?: HandlerOptions) => {
      if (!handlers.has(scope)) handlers.set(scope, new Map());
      handlers.get(scope)!.set(hotkey, { handler, options });
      return () => handlers.get(scope)?.delete(hotkey);
    },
    [handlers]
  );

  const contextValue = useMemo(
    () => ({ activeScope, pushScope, register }),
    [activeScope, pushScope, register]
  );

  return <KeyboardContext.Provider value={contextValue}>{children}</KeyboardContext.Provider>;
}

export function useKeyboard(): KeyboardContextValue {
  const ctx = useContext(KeyboardContext);
  if (!ctx) {
    throw new Error("useKeyboard must be used within KeyboardProvider");
  }
  return ctx;
}
